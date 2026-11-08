"""Reproduce render-lock blocking and check cancellation and callback ownership."""
from pathlib import Path
import tempfile,subprocess,shutil,sys,json
repo=Path(__file__).resolve().parents[2];root=repo/'node_modules/react-native-filament/cpp'
source=r'''
#include "RNFListenerManager.h"
#include "RNFChoreographer.h"
#include <cassert>
#include <chrono>
#include <condition_variable>
#include <future>
#include <iostream>
#include <thread>
#include <vector>
using namespace margelo;
using Fn=std::function<void()>;
using Manager=ListenerManager<Fn>;
int main(){
 auto manager=Manager::create();std::promise<void> entered,finish;auto done=finish.get_future().share();
 auto lifetime=std::make_shared<int>(42);std::weak_ptr<int> alive=lifetime;
 auto listener=manager->add([&,lifetime]{entered.set_value();done.wait();assert(*lifetime==42);});
 lifetime.reset();std::thread frame([&]{manager->forEach([](const Fn& fn){fn();});});entered.get_future().wait();
 auto removal=std::async(std::launch::async,[&]{listener->remove();});
 bool immediate=removal.wait_for(std::chrono::milliseconds(250))==std::future_status::ready;
 assert(!alive.expired());finish.set_value();frame.join();removal.get();assert(alive.expired());listener.reset();
#ifdef BASELINE
 if(!immediate){std::cout<<"Reproduced: removal waits behind the blocked render callback.\n";return 2;}
 return 3;
#else
 assert(immediate);assert(!manager->getHasListeners());
 // Separate dispatchers remain serialized while cancellation stays independent.
 auto serial=Manager::create();std::atomic_int dispatches=0;std::promise<void> firstEntered,secondEntered,unblock;
 auto unblockFuture=unblock.get_future().share();auto secondFuture=secondEntered.get_future();
 auto serialized=serial->add([&]{if(++dispatches==1){firstEntered.set_value();unblockFuture.wait();}else secondEntered.set_value();});
 std::thread one([&]{serial->forEach([](const Fn& fn){fn();});});firstEntered.get_future().wait();
 std::thread two([&]{serial->forEach([](const Fn& fn){fn();});});
 assert(secondFuture.wait_for(std::chrono::milliseconds(50))==std::future_status::timeout);unblock.set_value();one.join();two.join();assert(dispatches==2);serialized->remove();
 auto nested=Manager::create();int nesting=0;auto nest=nested->add([&]{if(++nesting==1)nested->forEach([](const Fn& fn){fn();});});
 nested->forEach([](const Fn& fn){fn();});assert(nesting==2);nest->remove();
 int first=0,second=0,third=0;std::shared_ptr<Listener> a,b,c;
 a=manager->add([&]{first++;a->remove();b->remove();});b=manager->add([&]{second++;});c=manager->add([&]{third++;});
 manager->forEach([](const Fn& fn){fn();});assert(first==1&&second==0&&third==1);
 manager->forEach([](const Fn& fn){fn();});assert(first==1&&second==0&&third==2);
 manager->clear();a->remove();b->remove();c->remove();assert(!manager->getHasListeners());
 a=manager->add([&]{manager->clear();});b=manager->add([&]{second++;});manager->forEach([](const Fn& fn){fn();});assert(second==0);a->remove();b->remove();
 int appended=0;std::shared_ptr<Listener> later;
 a=manager->add([&]{if(!later)later=manager->add([&]{appended++;});});manager->forEach([](const Fn& fn){fn();});assert(appended==0);
 manager->forEach([](const Fn& fn){fn();});assert(appended==1);manager->clear();a->remove();later->remove();
 std::atomic_int removals=0;auto once=Listener::create([&]{removals++;});std::vector<std::thread> threads;
 for(int i=0;i<16;i++)threads.emplace_back([&]{once->remove();});for(auto& t:threads)t.join();once.reset();assert(removals==1);
 struct Clock:Choreographer{void start()override{}void stop()override{}void fire(){onFrame(1);}};
 auto clock=std::make_shared<Clock>();int ticks=0;auto tick=clock->addOnFrameListener([&](double){ticks++;clock->removeAllListeners();});
 auto skipped=clock->addOnFrameListener([&](double){ticks+=100;});clock->fire();clock->fire();assert(ticks==1);tick->remove();skipped->remove();
 std::cout<<"Native listeners: nonblocking removal, in-flight lifetime, serialized dispatch, reentrancy, clear, deferred additions and concurrent once-only cancellation passed.\n";
#endif
}
'''
subprocess.run(['node',str(repo/'scripts/native/patch-filament-listeners.mjs')],check=True)
for baseline in [True,False]:
 with tempfile.TemporaryDirectory(prefix='brainpet-handoff-listeners-') as directory:
  p=Path(directory);(p/'jsi').mkdir()
  for name in ['RNFListenerManager.h','RNFListener.h','RNFListener.cpp','RNFChoreographer.h','RNFChoreographer.cpp']:
   shutil.copy(root/name,p/name)
  if baseline:
   (p/'cpp').mkdir()
   for file in p.glob('RNF*'): shutil.copy(file,p/'cpp'/file.name)
   subprocess.run(['patch','-R','-p1','--fuzz=0','--batch','-i',str(repo/'scripts/native/patches/react-native-filament-1.11.0-listeners.patch')],cwd=p,check=True,stdout=subprocess.DEVNULL)
   for file in (p/'cpp').glob('*'): shutil.copy(file,p/file.name)
  (p/'jsi/RNFHybridObject.h').write_text('#pragma once\n#include "../RNFLogger.h"\nnamespace margelo {class HybridObject {public:explicit HybridObject(const char*){}virtual ~HybridObject()=default;virtual void loadHybridMethods(){}template<typename... T>void registerHybridMethod(T&&...){} };}\n')
  (p/'RNFLogger.h').write_text('#pragma once\nnamespace margelo {struct Logger {template<typename... T>static void log(T&&...){} };}\n')
  (p/'main.cpp').write_text(source)
  cmd=['c++','-std=c++17','-pthread','-I',str(p),str(p/'main.cpp'),str(p/'RNFListener.cpp'),str(p/'RNFChoreographer.cpp'),'-o',str(p/'check')]
  if baseline:cmd.insert(1,'-DBASELINE')
  elif '--sanitizers' in sys.argv:cmd.insert(1,'-fsanitize=address,undefined')
  subprocess.run(cmd,check=True);result=subprocess.run([str(p/'check')],capture_output=True,text=True,timeout=10);print(result.stdout,end='');assert result.returncode==(2 if baseline else 0),(result.returncode,result.stderr)

# Verify clean-install application, idempotence and fail-closed package/source guards.
with tempfile.TemporaryDirectory(prefix='brainpet-filament-install-') as directory:
 p=Path(directory);package=p/'node_modules/react-native-filament';(package/'cpp').mkdir(parents=True)
 for name in ['RNFListenerManager.h','RNFListener.h','RNFListener.cpp','RNFChoreographer.cpp']:shutil.copy(root/name,package/'cpp'/name)
 patch=repo/'scripts/native/patches/react-native-filament-1.11.0-listeners.patch'
 subprocess.run(['patch','-R','-p1','--fuzz=0','--batch','-i',str(patch)],cwd=package,check=True,stdout=subprocess.DEVNULL)
 scripts=p/'scripts/native';(scripts/'patches').mkdir(parents=True);shutil.copy(patch,scripts/'patches'/patch.name)
 installer=scripts/'patch-filament-listeners.mjs';shutil.copy(repo/'scripts/native/patch-filament-listeners.mjs',installer)
 manifest=package/'package.json';manifest.write_text(json.dumps({'version':'1.11.0'}))
 for _ in range(2):subprocess.run(['node',str(installer)],check=True,stdout=subprocess.DEVNULL)
 manifest.write_text(json.dumps({'version':'1.11.1'}));assert subprocess.run(['node',str(installer)],capture_output=True).returncode!=0
 manifest.write_text(json.dumps({'version':'1.11.0'}));file=package/'cpp/RNFListenerManager.h';file.write_text(file.read_text()+'\n// unreviewed change\n')
 assert subprocess.run(['node',str(installer)],capture_output=True).returncode!=0
 print('Patch clean install, repeat application, version pin and modified-source rejection passed.')
