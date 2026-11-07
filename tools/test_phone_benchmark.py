import importlib.util
import unittest

spec = importlib.util.spec_from_file_location("phone_benchmark", "tools/phone-benchmark.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class BenchmarkMathTests(unittest.TestCase):
    def test_percentile_and_summary_are_deterministic(self):
        self.assertEqual(mod.percentile([1, 2, 3, 4, 5], 95), 4.8)
        self.assertEqual(mod.summary([10, 20, 30])["median_ms"], 20)
        self.assertEqual(mod.summary([10, 20, 30])["p95_ms"], 29.0)

    def test_empty_summary_is_explicit(self):
        self.assertIsNone(mod.percentile([], 95))

if __name__ == "__main__":
    unittest.main()
