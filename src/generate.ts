import { initializeApp } from "./app";
import QRCode from 'qrcode';
import { createButton, createMessage, makeElement } from "./modules/utils";

export async function createQRCodeWithLogo(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');

    QRCode.toCanvas(canvas, url, { errorCorrectionLevel: 'H', width: 300, margin: 1 }, (error) => {
      if (error) return reject(error);

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not get 2D context'));

      const logo = new Image();
      logo.src = "https://raw.githubusercontent.com/MontesOwn/days-for-girls-solon/refs/heads/main/images/icon-with-background.png";
      logo.crossOrigin = 'anonymous';

      logo.onload = () => {
        const qrSize = canvas.width;
        const safePercent = Math.min(30) / 100;
        const logoSize = qrSize * safePercent;
        
        const x = (qrSize - logoSize) / 2;
        const y = (qrSize - logoSize) / 2;

        ctx.drawImage(logo, x, y, logoSize, logoSize);

        resolve(canvas);
      };

      logo.onerror = (err) => {
        reject(new Error('Failed to load logo image: ' + err));
      };
    });
  });
}

initializeApp("Generate", "Generate").then(()=> {
    const qrForm = document.getElementById("qr-form") as HTMLFormElement;
    const qrSection = document.getElementById("generate-qr-code") as HTMLElement;

    qrForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(qrForm);
        const urlInput = formData.get("url-input");
        let url = ""
        if (!urlInput || urlInput.toString().trim() === "") {
            createMessage("Please enter the url", "main-message", "error");
            return;
        } else {
            url = urlInput.toString().trim();
        }
        const nameInput = formData.get("qr-name");
        if (!nameInput || nameInput.toString().trim() === "") {
            createMessage("Please give a name for the QR Code", "main-message", "error");
            return;
        }
        try {
            const canvas = await createQRCodeWithLogo(url);
            qrSection.appendChild(canvas);
            const btnRow = makeElement("div", null, "button-row", null);
            const downloadBtn = createButton("Download QR Code", "button", "download", "accent-button", "download");
            downloadBtn.onclick = function () {
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = dataUrl;
                    a.download = `d4g-${nameInput}.png`
                    a.click();
                } catch (err) {
                    createMessage(`Could not download image: ${err}`, "main-message", "error");
                }
            }
            qrForm.reset();
            const newBtn = createButton("Generate new QR Code", "button", "new", "accent-button");
            newBtn.onclick = function() {window.location.reload()}
            btnRow.append(downloadBtn, newBtn);
            qrSection.appendChild(btnRow);
            qrForm.remove();
        } catch (error) {
            console.error('Error generating QR code:', error);
        }
    });

})