from twisted.trial import unittest
from globaleaks.utils.objectdict import ObjectDict


class TestUtility(unittest.TestCase):

    def test_object_dict(self):
        od = ObjectDict()
        self.assertEqual(od.foo, None)
        od['foo'] = 'bar'
        self.assertEqual(od['foo'], 'bar')
        self.assertEqual(od.foo, 'bar')
        od.key = 'value'
        self.assertEqual(od['key'], 'value')
