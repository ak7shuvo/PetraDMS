"""Render the product dashboards in Chromium and save screenshots to public/products.

Usage: python3 scripts/capture.py [dms|pms|pos ...]   (default: all)
Sources live in mockups/. PetraDMS is the supplied prototype, captured unmodified.
"""
import sys, io
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "products"
OUT.mkdir(parents=True, exist_ok=True)
W, H, SCALE = 1440, 900, 1.5

def save(page, name):
    png = page.screenshot(type="png")
    img = Image.open(io.BytesIO(png)).convert("RGB")
    img.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
    print("saved", name, img.size)

def dms(page):
    page.goto((ROOT / "mockups/petradms.html").as_uri())
    page.wait_for_timeout(500)
    save(page, "dms-dashboard")
    for key, label in [("Sales", "dms-sales"), ("Inventory", "dms-inventory"), ("Reports", "dms-reports")]:
        page.click(f'nav a[data-n="{key}"]')
        page.wait_for_timeout(350)
        if key == "Reports":
            page.click('.tabs button:has-text("Profit & Margin")')
            page.wait_for_timeout(250)
        save(page, label)
    page.click('nav a[data-n="Dashboard"]')
    page.wait_for_timeout(200)
    page.click("#cb")
    page.wait_for_timeout(700)
    save(page, "dms-compact")

def simple(src, shots):
    def run(page):
        page.goto((ROOT / f"mockups/{src}.html").as_uri())
        page.wait_for_timeout(500)
        for sel, name in shots:
            if sel:
                page.click(sel); page.wait_for_timeout(350)
            save(page, name)
    return run

JOBS = {
    "dms": dms,
    "pms": simple("petrapms", [(None, "pms-dashboard"), ('[data-view="frontdesk"]', "pms-frontdesk"), ('[data-view="rooms"]', "pms-rooms"), ('[data-view="billing"]', "pms-billing")]),
    "pos": simple("petrapos", [(None, "pos-terminal"), ('[data-view="analytics"]', "pos-analytics"), ('[data-view="kitchen"]', "pos-kitchen"), ('[data-view="tables"]', "pos-tables")]),
}

if __name__ == "__main__":
    which = sys.argv[1:] or list(JOBS)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for k in which:
            ctx = b.new_context(viewport={"width": W, "height": H}, device_scale_factor=SCALE)
            page = ctx.new_page()
            JOBS[k](page)
            ctx.close()
        b.close()
