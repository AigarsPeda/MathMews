require 'xcodeproj'
root = ARGV.fetch(0)
project = Xcodeproj::Project.new("#{root}/NativeDrag.xcodeproj")
target = project.new_target(:ui_test_bundle, 'NativeDragTests', :ios, '18.0')
target.build_configurations.each do |c|
 c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.mathmews.NativeDragTests'
 c.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
 c.build_settings['SWIFT_VERSION'] = '5.0'
 c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
 c.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
end
file = project.main_group.new_file('NativeDragTests.swift')
target.source_build_phase.add_file_reference(file)
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'NativeDragTests', true)
