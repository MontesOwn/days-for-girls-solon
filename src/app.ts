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
import { updateContent } from "./i18n";
import i18n from './i18n';

// Cache elements safely using Nullable types instead of forceful type-casting
const pageWrapper = document.getElementById("page-wrapper");
const mobileNavToggle = document.getElementById("mobile-nav-toggle");
const githubTemplateBaseURL =
  "https://raw.githubusercontent.com/MontesOwn/days-for-girls-solon/refs/heads/main/";

// Global DOM elements
let nav: HTMLElement | null = null;
let signInButton: HTMLElement | null = null;
let signOutButton: HTMLElement | null = null;
let inventoryLink: HTMLElement | null = null;
let generateLink: HTMLElement | null = null;

// Used to detect when a user signs in or out
function setUpAuthListener() {
  console.log("set up auth listener running");

  // Helper function to handle UI logic so we don't duplicate code
  const updateAuthUI = (user: any) => {
    if (!inventoryLink || !generateLink || !signInButton || !signOutButton) {
      if (!inventoryLink) console.error("inventory link missing")
        if (!generateLink) console.error("generate link missing")
      console.warn("Auth UI skipped: DOM elements missing.");
      return;
    }

    if (user) {
      // User is signed in
      signInButton.style.display = "none";
      signOutButton.style.display = "block";
      inventoryLink.classList.remove("hide");
      generateLink.classList.remove("hide");
      console.log("UI Updated: User logged in");
    } else {
      // User is not signed in
      inventoryLink.classList.add("hide");
      generateLink.classList.add("hide");
      signInButton.style.display = "block";
      signOutButton.style.display = "none";
      console.log("UI Updated: User logged out");
    }
  };

  // 1. Listen for future auth changes (sign-in, sign-out events)
  auth.onAuthStateChanged((user) => {
    updateAuthUI(user);
  });

  // 2. CATCH THE RACE CONDITION: Force an immediate, manual check 
  // right now since the DOM elements are finally ready.
  if (auth.currentUser) {
    updateAuthUI(auth.currentUser);
  } else {
    // If auth is still initializing, Firebase modern SDKs provide a promise 
    // we can await to see if a user settles in.
    auth.authStateReady?.().then(() => {
      if (auth.currentUser) updateAuthUI(auth.currentUser);
    });
  }
}

export async function initializeApp(parentPage: string, currentPage: string) {
  // 1. Set the page title
  document.title = `${currentPage} - Days for Girls Solon`;

  // 2. Wait for the DOM structure to be ready natively
  if (document.readyState === "loading") {
    await new Promise<void>((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }

  // 3. Parallel fetch of templates (Busts the async waterfall bottleneck)
  try {
    await Promise.all([
      loadHeader(parentPage),
      loadFooter(),
      loadModals()
    ]);
  } catch (error) {
    console.error("Critical layout components failed to load", error);
  }

  // 4. Bind elements immediately AFTER they are injected into the DOM
  nav = document.querySelector("nav");
  inventoryLink = document.getElementById("inventory-link");
  generateLink = document.getElementById("generate-link");
  signInButton = document.getElementById("sign-in-button");
  signOutButton = document.getElementById("sign-out-button");

  // 5. Fire up the Auth listener now that elements are safely assigned
  setUpAuthListener();

  // 6. Check for waiting messages
  retrieveMessage();

  // 7. Setup Language Switcher
  const btn = document.getElementById('toggle-btn');
  btn?.addEventListener('click', async () => {
    const targetLang = i18n.resolvedLanguage === 'en' ? 'es' : 'en';
    await i18n.changeLanguage(targetLang);
    console.log(`Language changed to: ${targetLang}`);
  });
  
  updateContent();

  // 8. Mobile Nav Toggle Handler (With type guard fixes)
  mobileNavToggle?.addEventListener("click", () => {
    if (!nav) return;
    
    nav.classList.toggle("open");
    const isOpen = nav.classList.contains("open");
    
    if (mobileNavToggle instanceof HTMLElement) {
      mobileNavToggle.innerText = isOpen ? "close" : "menu";
    }
  });

  // 9. Sign In Button Handler
  signInButton?.addEventListener("click", async (e) => {
    e.preventDefault();
    closeMobileNav();
    
    createMessage(i18n.t('app_open_google'), "main-message", "info");
    try {
      const result = await signInWithGooglePopup();
      if (result?.user) {
        createMessage(
          i18n.t('app_welcome', { name: result.user.displayName }),
          "main-message",
          "check_circle",
        );
      }
    } catch (error: any) {
      let errorMessage = i18n.t('app_sign_failed');
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = i18n.t('app_google_closed');
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMessage = i18n.t('app_google_already');
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      createMessage(errorMessage, "main-message", "error");
      console.error("Google sign-in error details:", error);
    }
  });

  // 10. Sign Out Button Handler
  signOutButton?.addEventListener("click", () => {
    signOut();
  });

  // 11. Modal Escape Key Event Listener
  const modalBackdropIds = [
    "delete-item-backdrop",
    "edit-event-backdrop",
    "add-inventory-backdrop",
    "distribute-inventory-backdrop",
    "inventory-backdrop"
  ];

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    const activeModalId = modalBackdropIds.find(id => {
      const modal = document.getElementById(id);
      return modal && modal.style.display === "flex";
    });

    if (activeModalId) {
      e.preventDefault();
      closeModal(activeModalId);
    } else {
      console.warn("Esc key pressed, but no modals are open");
    }
  });
}

// Reusable template fetcher utility to dry up component code
async function fetchTemplate(endpoint: string): Promise<string> {
  const response = await fetch(`${githubTemplateBaseURL}templates/${endpoint}`);
  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText} fetching ${endpoint}`);
  }
  return response.text();
}

async function loadHeader(parentPage: string): Promise<void> {
  const placeholder = document.getElementById("header-placeholder");
  if (!placeholder || !pageWrapper) return;

  try {
    const headerData = await fetchTemplate("header.html");
    const header = document.createElement("header");
    header.innerHTML = headerData;

    pageWrapper.replaceChild(header, placeholder);

    // Apply active class semantics securely
    const currentNav = header.querySelector("nav");
    currentNav?.querySelectorAll("a").forEach((link) => {
      if (link.textContent === parentPage) {
        link.setAttribute("aria-current", "page");
      }
    });
  } catch (error) {
    console.error(`Failed to load the header: ${error}`);
  }
}

async function loadFooter(): Promise<void> {
  const placeholder = document.getElementById("footer-placeholder");
  if (!placeholder || !pageWrapper) return;

  try {
    const footerData = await fetchTemplate("footer.html");
    const footer = document.createElement("footer");
    footer.innerHTML = footerData;
    pageWrapper.replaceChild(footer, placeholder);
  } catch (error) {
    console.error(`Failed to load the footer: ${error}`);
  }
}

async function loadModals(): Promise<void> {
  const body = document.querySelector("body");
  const placeholder = document.getElementById("modal-placeholder");
  if (!placeholder || !body) return;

  try {
    const modalData = await fetchTemplate("modal.html");
    const modalsContainer = document.createElement("div");
    modalsContainer.innerHTML = modalData;
    body.replaceChild(modalsContainer, placeholder);
  } catch (error) {
    console.error(`Failed to load the modals: ${error}`);
  }
}

function closeMobileNav() {
  if (nav?.classList.contains("open") && mobileNavToggle) {
    mobileNavToggle.innerText = "menu";
    nav.classList.remove("open");
  }
}

function signOut() {
  signOutUser();
  closeMobileNav();
  createMessage(i18n.t('app_sign_out'), "main-message", "check_circle");
}