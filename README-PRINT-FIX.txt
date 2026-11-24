TexOS receipt printing fix
==========================

Replace:
- TexOS-frontend/src/pages/BillingManagement.jsx
- TexOS-frontend/src/pages/BillingManagement.css

Receipt print profiles:
- Thermal 80 mm (default): content-width optimized for common 80 mm receipt printers; page height is measured from the rendered receipt so it prints as one continuous custom-length page.
- Thermal 58 mm: narrower layout for common 58 mm printers.
- A4 PDF / printer: A4 page, scaled down to fit a single page.

The Download receipt action opens the browser print dialog. Choose "Save as PDF" there.
A web page cannot silently save a PDF file without the browser's print/save interaction.

Printer compatibility note:
This uses standard browser printing through the installed operating-system printer driver. For a thermal printer, install its driver and select the matching 58 mm or 80 mm paper width in printer preferences. This is not direct raw ESC/POS Bluetooth/USB printing; that requires a separate native/bridge integration.

Long receipts:
Thermal roll output uses a custom page length based on measured receipt height. A4 output is scaled to one page. Extremely long A4 receipts may have smaller text; use a thermal profile for restaurant counter printing.
