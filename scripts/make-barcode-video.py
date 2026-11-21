"""Erzeugt ein Testvideo (Y4M) mit einem EAN-13-Barcode für den Kamerascanner-E2E-Test (AK-019)."""
import subprocess, sys
import barcode
from barcode.writer import ImageWriter
from PIL import Image

code = sys.argv[1] if len(sys.argv) > 1 else '400638133393'
out = sys.argv[2] if len(sys.argv) > 2 else 'e2e/.fixtures/barcode.y4m'
img = barcode.get('ean13', code, writer=ImageWriter()).render({'module_width': 0.5, 'module_height': 30, 'quiet_zone': 8, 'font_size': 10})
canvas = Image.new('RGB', (640, 480), 'white')
img.thumbnail((600, 440))
canvas.paste(img, ((640 - img.width) // 2, (480 - img.height) // 2))
canvas.save('e2e/.fixtures/barcode.png')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', 'e2e/.fixtures/barcode.png', '-t', '3', '-r', '10', '-pix_fmt', 'yuv420p', out], check=True)
print('ok', out)
