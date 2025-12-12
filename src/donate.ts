import { initializeApp } from "./app.js";
import { createButton, createMessage, fixDate } from "./utils.js";
import { auth } from "./firebase.js";
import {
  addDonatePageContent,
  updateDonatePageContent,
  getDonatePageContent,
} from "./firebaseService.js";
import { DonatePageContent } from "./models.js";
import { getUserRole } from "./authService.js";
import { Timestamp } from "firebase/firestore";
import Quill from "quill";
import "quill/dist/quill.snow.css";

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
  //Create the Editor card
  const editorCard = document.createElement("article");
  editorCard.setAttribute("id", "editor-card");
  editorCard.setAttribute("class", "card hide");
  const quillSection = document.createElement("section");
  quillSection.setAttribute("id", "editor");
  editorCard.appendChild(quillSection);
  //Create the button row
  const buttonRow = document.createElement("section");
  buttonRow.setAttribute("class", "button-row");
  //Create the cancel button
  const cancelButton = createButton(
    "Cancel",
    "button",
    "cancel-button",
    "secondary",
  );
  cancelButton.addEventListener("click", () => {
    //Show the output card
    outputCard.classList.remove("hide");
    //Remove the editor card from the DOM
    editorCard.remove();
  });
  buttonRow.appendChild(cancelButton);
  //Create the update button
  const updateButton = createButton(
    "Update",
    "button",
    "update-button",
    "primary",
  );
  updateButton.addEventListener("click", async () => {
    submitData(quill, editorCard);
  });
  buttonRow.appendChild(updateButton);
  editorCard.appendChild(buttonRow);
  //Add the editor card to the DOM
  mainContent.appendChild(editorCard);
  //Define the Quill toolbar options
  const toolbarOptions = [
    [{ header: [1, 2, 3, 4] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }, { list: "check" }],
    ["blockquote", "link"],
  ];
  //Create the Quill text editor
  const quill = new Quill("#editor", {
    theme: "snow",
    modules: {
      toolbar: toolbarOptions,
    },
  });
  quill.setContents(JSON.parse(delta));
  //Hide the output card
  outputCard.classList.add("hide");
  //Show the editor card
  editorCard.classList.remove("hide");
}

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
        //Check to make sure don't need, then remove all this
        // //Event listener for the cancel button
        // const cancelButton = document.getElementById('cancel-button') as HTMLElement;
        // cancelButton.addEventListener('click', () => {
        //     //Remove the editor from the DOM
        //     const editor = document.getElementById('editor');
        //     if (editor) editor.remove();
        //     //Hide the editor card
        //     editorCard.classList.add('hide');
        //     //Show the output card
        //     outputCard.classList.remove('hide');
        // });
        // //Event listener for the update buttton
        // const updateButton = document.getElementById('update-button') as HTMLElement;
        // updateButton.addEventListener('click', () => {

        // })
      }
    } else {
      const editButton = document.getElementById("editButton");
      if (editButton) editButton.remove();
    }
  });
});
