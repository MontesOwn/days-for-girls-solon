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
import QuillTableBetter from 'quill-table-better';
import 'quill-table-better/dist/quill-table-better.css';

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
      html: "<h2>No Content Found</h2>",
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
    `Last updated: ${fixDate(donatePageContent["lastUpdated"], "longDate")}`,
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
  //Setup UI Elements
  const editorCard = document.createElement("article");
  editorCard.id = "editor-card";
  editorCard.className = "card hide";
  //Create a Loading Overlay for uploads
  const loader = document.createElement("div");
  loader.className = "quill-loading-overlay hide";
  loader.innerHTML = '<div class="spinner"></div>';
  editorCard.appendChild(loader);
  const quillSection = document.createElement("section");
  quillSection.id = "editor";
  editorCard.appendChild(quillSection);
  //Button Logic
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
  updateButton.onclick = () => submitData(quill, editorCard);
  buttonRow.append(cancelButton, updateButton);
  editorCard.appendChild(buttonRow);
  mainContent.appendChild(editorCard);
  //Cloudinary & Compression Configuration
  const CLOUD_NAME = "your_cloud_name";
  const UPLOAD_PRESET = "your_preset_name";
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
        //COMPRESS IMAGE
        const compressionOptions = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1200,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, compressionOptions);
        //UPLOAD TO CLOUDINARY
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('upload_preset', UPLOAD_PRESET);
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: 'POST', body: formData }
        );
        const data = await response.json();
        //INSERT INTO QUILL
        if (data.secure_url) {
          const range = quill.getSelection();
          const index = range ? range.index : quill.getLength();
          quill.insertEmbed(index, 'image', data.secure_url);
          quill.setSelection(index + 1);
        }
      } catch (error) {
        console.error("Upload process failed:", error);
        alert("Error processing image.");
      } finally {
        loader.classList.add('hide');
      }
    };
  };
  Quill.register('modules/blotFormatter', BlotFormatter);
  Quill.register({ 'modules/table-better': QuillTableBetter }, true);
  //Initialize Quill
  const toolbarOptions = [
    [{ header: [1, 2, 3, 4] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "link", "image"],
    ['table-better']
  ];
  const quill = new Quill("#editor", {
    theme: "snow",
    modules: {
      table: false,
      'table-better': {
        toolbarTable: true,
      },
      toolbar: {
        container: toolbarOptions,
        handlers: { image: imageHandler }
      },
      blotFormatter: { allowDeselect: true }
    },
  });
  //Load existing content
  if (delta && delta !== "") {
    quill.setContents(JSON.parse(delta));
  }
  outputCard.classList.add("hide");
  editorCard.classList.remove("hide");
}