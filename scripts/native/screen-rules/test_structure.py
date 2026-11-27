import unittest

from analyze import question_labels, structure, walk


def equation(x, children=(), label="5:30"):
    return dict(type="StaticText", AXLabel=label, children=children,
                frame=dict(x=x, y=21, width=100, height=20))


def inspect(nodes):
    boxes = {"play-proof-model": [[0, 0, 20, 20]],
             "play-proof-equation": [[0, 20, 300, 60]]}
    return structure(boxes, list(walk(nodes)), [])


class EquationStructureTest(unittest.TestCase):
    def test_overlapping_identical_nested_label_counts_once(self):
        result = inspect([equation(10, [equation(18)])])
        self.assertEqual("PASS", result["status"])
        self.assertEqual(["5:30"], result["equations"])

    def test_separate_equations_still_count(self):
        for nodes in ([equation(10), equation(18)],
                      [equation(10, [equation(112)])],
                      [equation(10, [equation(18, label="6:30")])]):
            with self.subTest(nodes=nodes):
                result = inspect(nodes)
                self.assertEqual("FAIL", result["status"])
                self.assertEqual(2, len(result["equations"]))


class FixtureIdentityTest(unittest.TestCase):
    def test_unlabelled_story_group_uses_the_native_question_in_its_bounds(self):
        group = dict(type="Group", AXUniqueId="puzzle-question",
                     frame=dict(x=0, y=0, width=120, height=60))
        prompt = equation(10, label="How many remain?")
        unrelated = equation(140, label="Try again")
        self.assertEqual({"How many remain?"}, question_labels(list(walk([group, prompt, unrelated]))))
        self.assertEqual(set(), question_labels(list(walk([group, unrelated]))))


class StackedFractionTest(unittest.TestCase):
    def test_fraction_labels_and_their_children_form_one_equation(self):
        def node(role, text, x, y, w, h):
            return dict(type=role, AXLabel=text, frame=dict(x=x, y=y, width=w, height=h))

        nodes = [node('GenericElement', '3/5', 10, 21, 30, 38),
                 node('StaticText', '5', 20, 45, 10, 12),
                 node('StaticText', '=', 45, 33, 12, 12),
                 node('GenericElement', '12/20', 65, 21, 35, 38)]
        self.assertEqual(['3/5 = 12/20'], inspect(nodes)['equations'])
        self.assertEqual('FAIL', inspect([*nodes, node('StaticText', '8', 140, 33, 12, 12)])['status'])
