import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

async def generate_pdf():
    html_path = Path(__file__).parent / "components.html"
    output_path = Path(__file__).parent / "components.pdf"

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1050, "height": 800})
        await page.goto(f"file:///{html_path.resolve()}")
        await page.wait_for_load_state("networkidle")
        await page.pdf(
            path=str(output_path),
            format="A4",
            print_background=True,
            margin={"top": "18mm", "right": "18mm", "bottom": "18mm", "left": "18mm"},
        )
        await browser.close()
    print(f"PDF sparad: {output_path}")

asyncio.run(generate_pdf())
