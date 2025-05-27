import os
import time
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains

# Load kredensial dari .env
load_dotenv()
COMPANY = os.getenv("PHOENIX_COMPANY")
USERNAME = os.getenv("PHOENIX_USERNAME")
PASSWORD = os.getenv("PHOENIX_PASSWORD")

# Setup Chrome
chrome_options = Options()
chrome_options.add_argument("--start-maximized")
service = Service(executable_path="chromedriver-win64/chromedriver.exe")
driver = webdriver.Chrome(service=service, options=chrome_options)

# Akses halaman login Phoenix
driver.get("https://ttlc.phoenix-wms.com/phoenix/login/auth")

# Tunggu dan isi "Company Code"
wait = WebDriverWait(driver, 15)
company_input = wait.until(EC.element_to_be_clickable((By.ID, "companyname")))
company_input.send_keys(COMPANY)

# Isi "Username"
username_input = wait.until(EC.element_to_be_clickable((By.ID, "usercode")))
username_input.send_keys(USERNAME)

# Isi "Password"
password_input = wait.until(EC.element_to_be_clickable((By.ID, "password")))
password_input.send_keys(PASSWORD)

# Klik tombol Login
login_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".LoginSub input[type='submit']")))
login_button.click()

# Tunggu sampai dashboard terbuka (Inventory menu muncul)
inventory_menu = wait.until(EC.presence_of_element_located((By.XPATH, "//span[text()='Inventory']")))

# Hover ke menu "Inventory"
actions = ActionChains(driver)
actions.move_to_element(inventory_menu).perform()

# Tunggu dan klik "Outbound Management"
outbound_menu = wait.until(EC.element_to_be_clickable((
    By.XPATH, "//a[contains(@href, '/phoenix/outbound') and span[text()='Outbound Management']]"
)))
outbound_menu.click()

# Tunggu sampai halaman Outbound Management muncul
wait.until(EC.presence_of_element_located((By.XPATH, "//table")))
print("✅ Berhasil masuk ke halaman Outbound Management!")

# Tunggu sampai checkbox utama muncul lalu klik (centang semua)
checkbox_all = wait.until(EC.element_to_be_clickable((By.ID, "cb_grid-outbound")))
checkbox_all.click()
print("✅ Semua baris berhasil dicentang.")

# Hover ke tombol Export
export_btn = wait.until(EC.presence_of_element_located((By.XPATH, "//a[contains(text(),'Export')]")))
actions = ActionChains(driver)
actions.move_to_element(export_btn).perform()

# Tambahkan jeda biar tombol Export Selected muncul
time.sleep(2)

# Klik tombol Export untuk memunculkan opsi dropdown (kalau perlu)
export_btn.click()

# Tunggu tombol Export Selected muncul dan bisa diklik
export_selected_btn = wait.until(EC.element_to_be_clickable((By.ID, "exportSelected")))
export_selected_btn.click()
print("📁 Export Selected diklik.")
time.sleep(5)  # tambahkan waktu tunggu



