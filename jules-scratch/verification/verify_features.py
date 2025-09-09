from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Listen for console errors
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

    import os
    file_path = os.path.abspath('coincompare/index.html')
    page.goto(f'file://{file_path}')

    # Wait for the table to be populated by looking for a specific row
    expect(page.locator('tr:has-text("比特币")')).to_be_visible(timeout=10000)

    # Check for any console errors after loading
    if errors:
        raise Exception(f"Console errors found during page load: {errors}")

    # Check the content of the arbitrage cell for BTC
    btc_row = page.locator('tr:has-text("比特币")')
    arbitrage_cell = btc_row.locator('.arbitrage-cell')

    # Assert that the viability icon and common chains are present and visible
    expect(arbitrage_cell.locator('text=✅')).to_be_visible()
    expect(arbitrage_cell.locator('.common-chains')).to_be_visible()
    expect(arbitrage_cell.locator('.common-chains')).to_contain_text('🔗')

    # Click the "Deposit/Withdraw Info" button
    page.click('button#deposit-withdraw-btn')

    # Wait for the panel to be visible
    deposit_panel = page.locator('#deposit-withdraw-panel')
    expect(deposit_panel).to_be_visible()

    # Check for some content in the panel
    expect(deposit_panel.locator('h5')).to_contain_text('BTC 充提网络信息')
    expect(deposit_panel.locator('h6:has-text("Binance")')).to_be_visible()
    expect(deposit_panel.locator('p:has-text("支持的充值网络")')).to_contain_text('Bitcoin, Segwit, BSC')

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

    print("Verification script executed successfully. No console errors found and UI elements are correct.")

with sync_playwright() as playwright:
    run(playwright)
