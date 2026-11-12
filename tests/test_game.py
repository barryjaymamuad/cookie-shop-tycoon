"""Browser regression tests. Run: python3 -m unittest discover -s tests -v"""
import functools
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright


class GameTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(SimpleHTTPRequestHandler, directory=str(Path(__file__).resolve().parents[1]))
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(reduced_motion='reduce')
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.add_init_script('Math.random = () => 0.5')
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}')
        self.fill(ads=0)

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def fill(self, **values):
        for key, value in values.items():
            self.page.locator('#' + key).fill(str(value))

    def open_shop(self):
        self.page.locator('#open').click()

    def text(self, selector):
        return self.page.locator(selector).inner_text()

    def test_prices_and_inventory(self):
        self.assertEqual(self.text('#satisfaction'), '75/100')
        self.fill(batch=50, price=1.5)
        self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '80/100')
        self.assertIn('+3 points', self.text('#satisfactionReason'))
        self.assertIn('All 32 requested cookies were available (+2 points)', self.text('#satisfactionReason'))
        self.fill(price=3)
        self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '77/100')
        self.assertIn('above the starting prices', self.text('#satisfactionReason'))
        self.fill(batch=1, price=2)
        self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '67/100')
        self.assertIn('26 of 27 requested cookies were unavailable (-10 points)', self.text('#satisfactionReason'))
        self.assertEqual(self.page.locator('#rows tr').count(), 3)
        self.assertIn('80/100 (+5)', self.page.locator('#rows tr:last-child').text_content())

    def test_mixed_menu_off_menu_and_zero_demand(self):
        self.fill(batch=60, price=1, doubleBatch=20, doublePrice=5.5, macadamiaPrice=100)
        self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '80/100')  # weighted +3 price, +2 stock
        self.assertEqual(self.page.locator('#varietyRows tr').count(), 2)
        self.fill(batch=1, price=100, doubleBatch=0)
        self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '75/100')
        self.assertIn('No demand today; no inventory effect (0 points)', self.text('#satisfactionReason'))
        self.fill(batch=0)
        self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '65/100')
        self.assertIn('empty shop (-10 points)', self.text('#satisfactionReason'))

    def test_limits_completion_and_reset(self):
        self.fill(batch=40, price=1.5)
        for _ in range(5):
            self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '100/100')
        self.open_shop()
        self.assertIn('0 points today', self.text('#satisfactionChange'))
        self.assertIn('limited to the 0–100 range', self.text('#satisfactionReason'))
        self.fill(batch=0)
        for _ in range(24):
            self.open_shop()
        self.assertEqual(self.text('#satisfaction'), '0/100')
        self.assertTrue(self.page.locator('#finish').is_visible())
        self.assertEqual(self.page.locator('#rows tr').count(), 30)
        self.page.on('dialog', lambda dialog: dialog.accept())
        self.page.locator('#reset').click()
        self.assertEqual(self.text('#satisfaction'), '75/100')
        self.assertEqual(self.text('#cash'), '$100.00')
        self.assertEqual(self.page.locator('#rows tr').count(), 0)
        self.assertTrue(self.page.locator('#satisfactionReport').is_hidden())

    def test_budget_and_animation(self):
        self.fill(batch=10000)
        self.assertTrue(self.page.locator('#open').is_disabled())
        self.assertEqual(self.text('#satisfaction'), '75/100')
        self.fill(batch=40)
        self.page.emulate_media(reduced_motion='no-preference')
        self.open_shop()
        self.assertTrue(self.page.locator('#shopFloor').is_visible())
        self.assertEqual(self.text('#satisfaction'), '75/100')
        self.assertTrue(self.page.locator('#satisfactionReport').is_hidden())
        self.page.wait_for_function("document.getElementById('day').textContent === 'Day 2 of 30'")
        self.assertEqual(self.text('#satisfaction'), '77/100')
        self.assertTrue(self.page.locator('#satisfactionReport').is_visible())
        self.page.set_viewport_size({'width': 375, 'height': 812})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))


if __name__ == '__main__':
    unittest.main()
