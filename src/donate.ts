import { initializeApp } from "./app";
import { createButton, createMessage, fixDate } from "./modules/utils";
import { auth } from "./firebase";
import {
  addDonatePageContent,
  updateDonatePageContent,
  getDonatePageContent,
} from "./firebaseService";
import { DonatePageContent } from "./models";
import { getUserRole } from "./authService";
import { Timestamp } from "firebase/firestore";
import Quill from "quill";
import BlotFormatter from '@enzedonline/quill-blot-formatter2';
import "quill/dist/quill.snow.css";
import imageCompression from 'browser-image-compression';
import i18n from './i18n';

Quill.register('modules/blotFormatter', BlotFormatter);

//DOM elements
const outputCard = document.getElementById("output") as HTMLElement;
const mainContent = document.getElementById("maincontent") as HTMLElement;
const outputButtonRow = document.getElementById(
  "outputButtonRow",
) as HTMLElement;
const pageContentSection = document.getElementById(
  "pageContentSection",
) as HTMLElement;
let donatePageContent: DonatePageContent | null = null;
let hasDonateContent: boolean = false;

initializeApp("Donate", "Donate").then(() => {
  loadDonateContent();
  auth.onAuthStateChanged(async (user) => {
    //Only admins can edit the contents of the donate page
    if (user) {
      let userRole = await getUserRole(user.uid);
      if (userRole === "admin") {
        //If admin, add the edit button to the DOM
        const editButton = createButton(
          "Edit",
          "button",
          "editButton",
          "secondary",
          "edit",
        );
        //Event listener for the edit button
        editButton.addEventListener("click", async () => {
          outputCard.classList.add("hide");
          if (donatePageContent) {
            openQuillEditor(donatePageContent["delta"]);
          }
        });
        outputButtonRow.appendChild(editButton);
      }
    } else {
      const editButton = document.getElementById("editButton");
      if (editButton) editButton.remove();
    }
  });
});

async function loadDonateContent() {
  //Get the page content from the firestore
  pageContentSection.innerHTML = "";
  try {
    donatePageContent = await getDonatePageContent();
  } catch (error: any) {
    createMessage(error, "main-message", "error");
  }
  if (!donatePageContent) {
    //If there is no page content in the firestore, create a placeholder object
    donatePageContent = {
      html: `<h2>${i18n.t('no_content_found')}</h2>`,
      delta: "",
      lastUpdated: Timestamp.now(),
    };
  } else {
    hasDonateContent = true;
  }
  //Add the page content html to the output card
  pageContentSection.innerHTML = donatePageContent["html"];
  const lastUpdatedP = document.createElement("p");
  const lastUpdatedText = document.createTextNode(
    `${i18n.t('last_updated')}: ${fixDate(donatePageContent["lastUpdated"], "longDate")}`,
  );
  lastUpdatedP.appendChild(lastUpdatedText);
  const loadingCard = document.getElementById("loading");
  //Remove the loading card if it exists on the DOM
  if (loadingCard) loadingCard.remove();
  outputCard.classList.remove("hide");
  pageContentSection.appendChild(lastUpdatedP);
}

async function submitData(quill: any, editorCard: HTMLElement) {
  //Create a submitting data message while the app validates and submits the data
  createMessage(
    "Submitting data to update page content...",
    "main-message",
    "info",
  );
  const htmlContent = quill.root.innerHTML;
  const deltaContent = quill.getContents();
  const updatedContent: DonatePageContent = {
    html: htmlContent,
    delta: JSON.stringify(deltaContent),
    lastUpdated: Timestamp.now(),
  };
  if (hasDonateContent) {
    try {
      await updateDonatePageContent(updatedContent);
      createMessage(
        "Successfully update the page contents",
        "main-message",
        "check_circle",
      );
    } catch (error: any) {
      createMessage(error, "main-message", "error");
    }
    editorCard.remove();
    pageContentSection.innerHTML = updatedContent["html"];
    donatePageContent = updatedContent;
    const lastUpdatedP = document.createElement("p");
    const lastUpdatedText = document.createTextNode(
      `Last Updated: ${fixDate(updatedContent["lastUpdated"], "longDate")}`,
    );
    lastUpdatedP.appendChild(lastUpdatedText);
    pageContentSection.appendChild(lastUpdatedP);
  } else {
    try {
      await addDonatePageContent(updatedContent);
      createMessage(
        "Successfully update the page contents",
        "main-message",
        "check_circle",
      );
    } catch (error: any) {
      createMessage(error, "main-message", "error");
    }
  }
  outputCard.classList.remove("hide");
}

async function openQuillEditor(delta: string) {
  // 1. MANUALLY REGISTER THE TABLE ICON (Prevents the button from being empty/invisible)
  const icons = Quill.import('ui/icons') as any;
  icons['table'] = '<svg viewbox="0 0 18 18"><rect class="ql-stroke" height="12" width="15" x="1.5" y="3"></rect><line class="ql-stroke" x1="1.5" x2="16.5" y1="9" y2="9"></line><line class="ql-stroke" x1="1.5" x2="16.5" y1="14" y2="14"></line><line class="ql-stroke" x1="1.5" x2="16.5" y1="4" y2="4"></line><line class="ql-stroke" x1="6.5" x2="6.5" y1="3" y2="15"></line><line class="ql-stroke" x1="11.5" x2="11.5" y1="3" y2="15"></line></svg>';

  // Setup UI Elements (Existing code...)
  const editorCard = document.createElement("article");
  editorCard.id = "editor-card";
  editorCard.className = "card hide";

  const loader = document.createElement("div");
  loader.className = "quill-loading-overlay hide";
  loader.innerHTML = '<div class="spinner"></div>';
  editorCard.appendChild(loader);

  const quillSection = document.createElement("section");
  quillSection.id = "editor";
  editorCard.appendChild(quillSection);

  // Button Logic
  const buttonRow = document.createElement("section");
  buttonRow.className = "button-row";
  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.onclick = () => {
    outputCard.classList.remove("hide");
    editorCard.remove();
  };

  const updateButton = document.createElement("button");
  updateButton.textContent = "Update";
  updateButton.className = "primary";
  // Note: quill is defined below, but JS handles the closure
  updateButton.onclick = () => submitData(quill, editorCard);

  buttonRow.append(cancelButton, updateButton);
  editorCard.appendChild(buttonRow);
  mainContent.appendChild(editorCard);

  // Image Handler (Existing code...)
  const CLOUD_NAME = "dewvjqvzg";
  const UPLOAD_PRESET = "uw-file-upload";
  const imageHandler = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      loader.classList.remove('hide');
      try {
        const compressionOptions = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
        const compressedFile = await imageCompression(file, compressionOptions);
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', 'days-for-girls');
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.secure_url) {
          const range = quill.getSelection();
          const index = range ? range.index : quill.getLength();
          quill.insertEmbed(index, 'image', data.secure_url);
          quill.setSelection(index + 1);
        }
      } catch (error) {
        console.error("Upload process failed:", error);
      } finally {
        loader.classList.add('hide');
      }
    };
  };

  // 2. INITIALIZE QUILL
  const quill = new Quill("#editor", {
    theme: "snow",
    modules: {
      table: true, // Built-in table module
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["image", "table"] // Simpler table icon trigger
        ],
        handlers: {
          image: imageHandler,
          // FIX: Use explicit "this" typing for TypeScript
          table: function (this: any) {
            const rows = prompt("How many rows?", "3");
            const cols = prompt("How many columns?", "3");

            if (rows && cols) {
              const tableModule = this.quill.getModule('table');
              tableModule.insertTable(parseInt(rows), parseInt(cols));
            }
          }
        },
      },
      blotFormatter: { allowDeselect: true }
    },
  });

  // 3. LOAD CONTENT
  if (delta && delta !== "") {
    try {
      const parsedDelta = JSON.parse(delta);
      requestAnimationFrame(() => {
        setTimeout(() => {
          quill.setContents(parsedDelta, 'silent');
          // Update the cell count AFTER content is set
          console.log(document.querySelectorAll('.ql-editor td').length + " cells found");
        }, 50);
      });
    } catch (e) {
      console.error("Error parsing Delta from Firebase:", e);
    }
  }

  outputCard.classList.add("hide");
  editorCard.classList.remove("hide");
}