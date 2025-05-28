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
import pandas as pd
import firebase_admin
from firebase_admin import credentials, db

# Load kredensial dari .env
load_dotenv()
COMPANY = os.getenv("PHOENIX_COMPANY")
USERNAME = os.getenv("PHOENIX_USERNAME")
PASSWORD = os.getenv("PHOENIX_PASSWORD")
FIREBASE_DB_URL = os.getenv("FIREBASE_DB_URL")

# Inisialisasi Firebase
cred = credentials.Certificate(r"D:\\phoenix_bot\\serviceKey.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': FIREBASE_DB_URL
})

# Path file Excel hasil download
excel_path = r"C:\\Users\\Rizki Aldiansyah\\Downloads\\outbound-export-selected.xlsx"

# Setup Chrome
chrome_options = Options()
chrome_options.add_argument("--window-size=1920,1080")
chrome_options.add_argument("--headless=new")  # Gunakan mode headless baru
chrome_options.add_argument("--disable-gpu")  # Tambahan opsional
service = Service(executable_path="chromedriver-win64/chromedriver.exe")
driver = webdriver.Chrome(service=service, options=chrome_options)

# Akses halaman login Phoenix
driver.get("https://ttlc.phoenix-wms.com/phoenix/login/auth")

# Login
wait = WebDriverWait(driver, 15)
company_input = wait.until(EC.element_to_be_clickable((By.ID, "companyname")))
company_input.send_keys(COMPANY)
username_input = wait.until(EC.element_to_be_clickable((By.ID, "usercode")))
username_input.send_keys(USERNAME)
password_input = wait.until(EC.element_to_be_clickable((By.ID, "password")))
password_input.send_keys(PASSWORD)
login_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".LoginSub input[type='submit']")))
login_button.click()

# Navigasi ke halaman Outbound Management
inventory_menu = wait.until(EC.presence_of_element_located((By.XPATH, "//span[text()='Inventory']")))
actions = ActionChains(driver)
actions.move_to_element(inventory_menu).perform()
outbound_menu = wait.until(EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/phoenix/outbound') and span[text()='Outbound Management']]")))
outbound_menu.click()
wait.until(EC.presence_of_element_located((By.XPATH, "//table")))
print("✅ Berhasil masuk ke halaman Outbound Management!")

# Centang semua checkbox
checkbox_all = wait.until(EC.element_to_be_clickable((By.ID, "cb_grid-outbound")))
checkbox_all.click()
print("✅ Semua baris berhasil dicentang.")

# Klik Export Selected
export_btn = wait.until(EC.presence_of_element_located((By.XPATH, "//a[contains(text(),'Export')]")))
actions.move_to_element(export_btn).perform()
time.sleep(2)
export_btn.click()
export_selected_btn = wait.until(EC.element_to_be_clickable((By.ID, "exportSelected")))
export_selected_btn.click()
print("📁 Export Selected diklik.")
time.sleep(5)

# Baca Excel (header di baris ke-4, kolom B sampai T)
df = pd.read_excel(excel_path, header=3, usecols="B:T")
print("✅ File Excel berhasil dibaca. Berikut 5 baris pertama:")
print(df.head())

# Mapping kolom yang dibutuhkan
required_cols = ["Job No.", "ETD", "Delivery Note No.", "Ref No.", "Status", "BC No."]
df = df[required_cols].dropna(subset=["Job No."])

# Upload ke Firebase
upload_count = 0
error_count = 0
for _, row in df.iterrows():
    job_no = str(row["Job No."]).strip()
    if not job_no or any(x in job_no for x in ['.', '#', '$', '[', ']']):
        continue
    
    job_data = {
        "jobNo": job_no,
        "deliveryDate": str(row["ETD"]).strip(),
        "deliveryNote": str(row["Delivery Note No."]).strip(),
        "remark": str(row["Ref No."]).strip(),
        "status": str(row["Status"]).strip(),
        "qty": str(row["BC No."]).strip(),
        "team": "",
        "jobType": ""
    }
    try:
        ref_path = f"PhxOutboundJobs/{job_no}"
        db.reference(ref_path).set(job_data)
        upload_count += 1
    except Exception as e:
        print(f"❌ Gagal upload {job_no}: {e}")
        error_count += 1

print(f"✅ Upload selesai. Berhasil: {upload_count}, Gagal: {error_count}")

# Hapus file setelah upload
if os.path.exists(excel_path):
    os.remove(excel_path)
    print("🗑️ File Excel berhasil dihapus setelah upload.")

# Tutup browser
driver.quit()
