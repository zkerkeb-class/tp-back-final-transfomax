import openpyxl
import os
import re



dossier_script = os.path.dirname(os.path.abspath(__file__))
fichier_excel = os.path.join(dossier_script, "151_art.xlsx")

print(f"Analyse du fichier : {fichier_excel}...")

try:
    wb = openpyxl.load_workbook(fichier_excel)
    ws = wb.active 

    data = {}

    for row in ws.iter_rows(min_row=2):
        id, image = ws.cell(row=row[0].row, column=3).value, ws.cell(row=row[0].row, column=13).value

        if image:
            image = re.search(r'image\("(.+?)"\)', image)

            if image:
                print(image.group(1))
                data[id] = image.group(1)

            else :
                continue

        else :
            continue

    print(data)    

except Exception as e:
    print(f"Erreur : {e}")