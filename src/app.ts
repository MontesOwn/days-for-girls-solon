import {
  createMessage,
  closeModal,
  retrieveMessage,
} from "./modules/utils";
import {
  signInWithGooglePopup,
  signOutUser,
} from "./authService";
import { auth } from "./firebase";

const pageWrapper = document.getElementById("page-wrapper") as HTMLElement;
let mobileNavToggle = document.getElementById(
  "mobile-nav-toggle",
) as HTMLElement;
const githubTemplateBaseURL =
  "https://raw.githubusercontent.com/MontesOwn/days-for-girls-solon/refs/heads/main/";

//Global DOM elements
let nav: HTMLElement;
let signInButton: HTMLElement;
let signOutButton: HTMLElement;
let inventoryLink: HTMLElement;

//Used to detect when a user signs in or out
function setUpAuthListener() {
  auth.onAuthStateChanged((user) => {
    //Don't continue if these elements haven't loaded
    if (!inventoryLink || !signInButton || !signOutButton) return;

    if (user) {
      //User is signed in
      //Hide the sign in button and show the sign out button
      signInButton.style.display = "none";
      signOutButton.style.display = "block";
      //Show the inventory link
      if (inventoryLink.classList.contains("hide"))
        inventoryLink.classList.remove("hide");
    } else {
      //User is not signed in
      //Hide the inventory link
      if (!inventoryLink.classList.contains("hide"))
        inventoryLink.classList.add("hide");
      //Make sure the sign in button is displayed and the sign out button is not displayed
      signInButton.style.display = "block";
      signOutButton.style.display = "none";
    }
  });
}

export async function initializeApp(partentPage: string, currentPage: string) {
  //Set the page title
  document.title = `${currentPage} - Days for Girls Solon`;
  //Wait for the DOM to load
  await new Promise<void>((resolve) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => resolve(), {
        once: true,
      });
    } else {
      resolve();
    }
  });

  //Load the header and wait for it to be added to the DOM
  await loadHeader(partentPage, currentPage);
  //Load the footer
  await loadFooter();
  //Load the modals
  await loadModals();
  //Set the page elemenets once the header, footer, and modals are loaded and added to the DOM
  nav = document.querySelector("nav") as HTMLElement;
  inventoryLink = document.getElementById("inventory-link") as HTMLElement;
  signInButton = document.getElementById("sign-in-button") as HTMLElement;
  signOutButton = document.getElementById("sign-out-button") as HTMLElement;

  //User Authentication check
  setUpAuthListener();

  //Check to see if there is a message waiting to be displayed
  retrieveMessage();

  //Mobile Nav toggle
  mobileNavToggle.addEventListener("click", () => {
    //Toggle to class 'open' on nav's classList
    nav.classList.toggle("open");
    //Check if 'open' is in nav's classList
    const isOpen = nav.classList.contains("open");
    //Display proper icon in nav toggle button
    if (isOpen) {
      mobileNavToggle.innerText = "close";
    } else {
      mobileNavToggle.innerText = "menu";
    }
  });

  //event listener for sign in button to open sign in modal
  signInButton.addEventListener("click", async (e) => {
    e.preventDefault();
    //Change the mobile nav button back to the menu icon
    if (nav.classList.contains("open")) {
      mobileNavToggle.innerText = "menu";
      nav.classList.remove("open");
    }
    createMessage("Opening Google window...", "main-message", "info");
    try {
      const result = await signInWithGooglePopup();
      //If sucessful sign in with Google, close the modal and display the message
      const user = result.user;
      if (user) {
        //Close the sign in modal
        createMessage(
          `Welcome ${user.displayName}`,
          "main-message",
          "check_circle",
        );
      }
    } catch (error: any) {
      let errorMessage = "Sign-In failed.";
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-In window closed.";
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMessage = "Sign-In request already in progress.";
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      createMessage(errorMessage, "main-message", "error");
      console.error("Google sign-in error details:", error);
    }
  });

  //event listener to sign out
  signOutButton.addEventListener("click", () => {
    signOut();
  });

  //event listener for the user to press escape to close any modal that is open
  document.addEventListener("keydown", (e) => {
    let deleteItemModalBackdrop = document.getElementById(
      "delete-item-backdrop",
    );
    let editEventModalBackdrop = document.getElementById("edit-event-backdrop");
    let addInventoryModalBackdrop = document.getElementById(
      "add-inventory-backdrop",
    );
    let distributeInventoryBackdrop = document.getElementById(
      "distribute-inventory-backdrop",
    );
    let InventoryBackdrop = document.getElementById(
      "inventory-backdrop",
    );
    if (e.key === "Escape") {
      e.preventDefault();
      if (
        deleteItemModalBackdrop &&
        deleteItemModalBackdrop.style.display === "flex"
      ) {
        closeModal("delete-item-backdrop");
      } else if (
        editEventModalBackdrop &&
        editEventModalBackdrop.style.display === "flex"
      ) {
        closeModal("edit-event-backdrop");
      } else if (
        addInventoryModalBackdrop &&
        addInventoryModalBackdrop.style.display === "flex"
      ) {
        closeModal("add-inventory-backdrop");
      } else if (
        distributeInventoryBackdrop &&
        distributeInventoryBackdrop.style.display === "flex"
      ) {
        closeModal("distribute-inventory-backdrop");
      } else if (
        InventoryBackdrop &&
        InventoryBackdrop.style.display === "flex"
      ) {
        closeModal("inventory-backdrop");
      } else {
        console.warn("Esc key pressed, but no modals are open");
      }
    }
  });
}

async function loadHeader(
  partentPage: string,
  currentPage: string,
): Promise<void> {
  const headerPlaceholder = document.getElementById(
    "header-placeholder",
  ) as HTMLElement;
  try {
    //Get the header html from the header file. Using a relative path broke on GitHub pages
    const response = await fetch(githubTemplateBaseURL + "templates/header.html");
    if (!response.ok) {
      console.error(`${response.status}: ${response.statusText}`);
      throw new Error("Error fetching header");
    }
    //Wait while the app converts the data to a string to pass to innerHTML
    const headerData = await response.text();
    //Create the header element and set the header HTML
    let header = document.createElement("header");
    header.innerHTML = headerData;
    //Replace the header placeholder with the header
    pageWrapper.replaceChild(header, headerPlaceholder);
    //Set aria-current=page for the current page
    const nav = document.querySelector("nav") as HTMLElement;
    const navLinks = nav.querySelectorAll("a");
    navLinks.forEach((link) => {
      if (link.textContent === partentPage) {
        link.setAttribute("aria-current", "page");
      }
    });
  } catch (error) {
    console.error(`Failed to load the header: ${error}`);
  }
}

async function loadFooter(): Promise<void> {
  const footerPlaceholder = document.getElementById(
    "footer-placeholder",
  ) as HTMLElement;
  try {
    //Get the footer html from the footer file. Using a relative path broke on GitHub pages
    const response = await fetch(githubTemplateBaseURL + "templates/footer.html");
    if (!response.ok) {
      console.error(`${response.status}: ${response.statusText}`);
      throw new Error("Error fetching footer");
    }
    //Wait while the app converts the data to a string to pass to innerHTML
    const footerData = await response.text();
    //Create the footer element and set the footer HTML
    const footer = document.createElement("footer");
    footer.innerHTML = footerData;
    //Replace the placeholder with the footer
    pageWrapper.replaceChild(footer, footerPlaceholder);
  } catch (error) {
    console.error(`Failed to load the footer: ${error}`);
  }
}

async function loadModals() {
  const body = document.querySelector("body") as HTMLElement;
  const modalPlaceholder = document.getElementById(
    "modal-placeholder",
  ) as HTMLElement;
  try {
    //Get the modal html from the modal file. Using a relative path broke on GitHub pages
    const response = await fetch(githubTemplateBaseURL + "templates/modal.html");
    if (!response.ok) {
      console.error(`${response.status}: ${response.statusText}`);
      throw new Error("Error fetching modals");
    }
    //Wait while the app converts the data to a string to pass to innerHTML
    const modalData = await response.text();
    //Create the modals container
    const modalsContainer = document.createElement("div");
    modalsContainer.innerHTML = modalData;
    //Replace the placeholder with the modals
    body.replaceChild(modalsContainer, modalPlaceholder);
  } catch (error) {
    console.error(`Failed to load the modals: ${error}`);
  }
}

function signOut() {
  signOutUser();
  //Change the mobile nav button back to the menu icon
  if (nav.classList.contains("open")) {
    mobileNavToggle.innerText = "menu";
    nav.classList.remove("open");
  }
  createMessage("Signed Out Successfully", "main-message", "check_circle");
}
