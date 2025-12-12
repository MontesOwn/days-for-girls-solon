import { Timestamp } from "firebase/firestore";
import {
  createTableRow,
  createTable,
  createMessage,
  createDeleteModal,
  openModal,
  closeModal,
  fixDate,
  populateComponteTypeSelect,
  storeMessage,
  capitalizeFirstLetter
} from "./utils.js";
import {
  getFilteredLogEntries,
  addLogEntry,
  deleteLogEntry,
} from "./firebaseService.js";
import { initializeApp } from "./app.js";
import { InventoryEntry } from "./models.js";
import { auth } from "./firebase.js";
import { getUserRole } from "./authService.js";

//DOM Elements
const addInventoryModalBackdrop = document.getElementById(
  "add-inventory-backdrop",
) as HTMLElement;
const addInventoryModal = document.getElementById(
  "add-inventory-modal",
) as HTMLFormElement;
const previousEntriesCard = document.getElementById(
  "previous-entries-card",
) as HTMLElement;

function addNewRow(newEntry: InventoryEntry) {
  //Create a new row for the table with the entry details
  const keysToDisplay = [
    "entryDate",
    "componentType",
    "quantity",
    "whoDonated",
  ];
  const idKeyName = "entryId";
  const newRow = createTableRow(
    newEntry,
    keysToDisplay,
    idKeyName,
    5,
    "shortDate",
  );
  //Add an event Listner to the entry's delete button
  const deleteButton = newRow.querySelector("button");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      //Create/open the modal and get the button row to add event lsiteners
      const buttonRow = createDeleteModal(
        newEntry,
        `Are you sure you want to delete this entry?`,
      );
      if (buttonRow) {
        const noButton = buttonRow.children[0];
        const yesButton = buttonRow.children[1];
        if (yesButton) {
          yesButton.addEventListener("click", async () => {
            //Close the delete modal
            closeModal("delete-item-backdrop");
            try {
              //Delete the log entry
              const success = await deleteLogEntry(newEntry["entryId"]);
              //Create a message saying the log entry has been deleted
              createMessage(
                `Deleted entry ${fixDate(newEntry["entryDate"].toString(), "shortDate")}: ${newEntry["quantity"]} ${newEntry["componentType"]} to ${newEntry["destination"]}`,
                "main-message",
                "delete",
              );
              //Remove the entry from the table
              newRow.remove();
            } catch (error: any) {
              createMessage(error, "main-message", "error");
            }
          });
        }
        if (noButton) {
          noButton.addEventListener("click", () => {
            closeModal("delete-item-backdrop");
          });
        }
      }
    });
  }
  return newRow;
}

async function loadPreviousEntries() {
  let donateInventoryData: InventoryEntry[] = [];
  try {
    donateInventoryData = await getFilteredLogEntries("donated");
  } catch (error: any) {
    createMessage(error, "main-message", "error");
  }

  if (donateInventoryData.length === 0) {
    //Display no previous entries message
    let noEntriesP = document.createElement("p");
    let noEntries = document.createTextNode("No previous entries");
    noEntriesP.appendChild(noEntries);
    previousEntriesCard.appendChild(noEntriesP);
  } else {
    //Create the previous entries table
    const tableColumnHeaders: string[] = [
      "Date",
      "Component",
      "Quantity",
      "Who Donated",
      "Delete",
    ];
    const previousTableContainer = document.getElementById(
      "inventory-table-container",
    );
    if (previousTableContainer) previousTableContainer.remove();
    const tableContainer = document.createElement("div");
    tableContainer.setAttribute("id", "inventory-table-container");
    tableContainer.setAttribute("class", "table-container");
    const previousEntriesTable = createTable(
      "previous-entries-table",
      tableColumnHeaders,
    );
    let tableBody = donateInventoryData.reduceRight(
      (acc: HTMLElement, currentItem: InventoryEntry) => {
        //Create a row for the current item
        const newRow = addNewRow(currentItem);
        acc.appendChild(newRow);
        return acc;
      },
      document.createElement("tbody"),
    );
    tableBody.setAttribute("id", "donatedTableBody");
    previousEntriesTable.appendChild(tableBody);
    tableContainer.appendChild(previousEntriesTable);
    previousEntriesCard.appendChild(tableContainer);
  }
  const newDonatedEntryButton = document.getElementById(
    "newDonatedEntryButton",
  ) as HTMLElement;
  const loadingCard = document.getElementById("loading");
  //Remove the loading card and show the previous log entries and the distribute inventory button
  if (loadingCard) loadingCard.remove();
  if (newDonatedEntryButton.classList.contains("hide"))
    newDonatedEntryButton.classList.remove("hide");
  if (previousEntriesCard.classList.contains("hide"))
    previousEntriesCard.classList.remove("hide");
}

async function submitData() {
  //Create a 'submitting data' message while the app validates and submits the entry log
  createMessage("Submitting entry log data...", "donate-modal-message", "info");
  //Get the data from the form
  const donatedFormData: FormData = new FormData(addInventoryModal);
  //Create an object for the entry
  let newEntry = {
    entryId: "",
    entryDate: Timestamp.fromDate(new Date(0)),
    componentType: "",
    quantity: 0,
    whoDonated: "",
  };
  //Validate date input
  const dateValue = donatedFormData.get("date");
  if (dateValue === null || dateValue === "") {
    createMessage(
      "Please enter the date the components were donated",
      "donate-modal-message",
      "error",
    );
    return;
  } else {
    const jsDate = new Date(dateValue.toString());
    newEntry["entryDate"] = Timestamp.fromDate(jsDate);
  }
  //Validate component type selected input
  const componentTypeValue = donatedFormData.get("componentType");
  if (
    componentTypeValue === null ||
    componentTypeValue.toString().trim() === ""
  ) {
    createMessage(
      "Please select what component you are donating",
      "donate-modal-message",
      "error",
    );
    return;
  } else {
    newEntry["componentType"] = componentTypeValue.toString();
  }
  //Validate quantity input
  const quantityValue = donatedFormData.get("quantity");
  if (quantityValue === null) {
    createMessage(
      "Please enter the quantity of the components being donated",
      "donate-modal-message",
      "error",
    );
    return;
  } else {
    const quantity: number = +quantityValue;
    if (quantity < 1) {
      createMessage(
        "Please enter a quantity greater that 0",
        "donate-modal-message",
        "error",
      );
      return;
    } else {
      newEntry["quantity"] = quantity;
    }
  }
  //Validate who donated input
  const whoDonatedValue = donatedFormData.get("whoDonated");
  if (whoDonatedValue === null || whoDonatedValue.toString().trim() === "") {
    createMessage(
      "Please enter who donated the components",
      "donate-modal-message",
      "error",
    );
    return;
  } else {
    newEntry["whoDonated"] = capitalizeFirstLetter(whoDonatedValue.toString());
  }
  //Submit the entry
  try {
    let entryId = await addLogEntry(newEntry);
    if (entryId) {
      newEntry["entryId"] = entryId;
    }
    //Close the modal
    closeModal("add-inventory-backdrop");
    //Clear the form
    addInventoryModal.reset();
    createMessage(
      "The inventory has successfully been updated",
      "main-message",
      "check_circle",
    );
    //Get the donated log table body
    const donatedTableBody = document.getElementById("donatedTableBody");
    if (donatedTableBody) {
      //If the table body exists, add the new row to the top of the table
      const newRow = addNewRow(newEntry);
      donatedTableBody.prepend(newRow);
    } else {
      //If the table body does not exist, create/load the table
      loadPreviousEntries();
    }
  } catch (error: any) {
    createMessage(error, "donate-modal-message", "error");
  }
}

initializeApp("Inventory", "Donated Inventory").then(async () => {
  //Only admins are allowed to manage the inventory logs. If the user is not an admin or not signed in, redirect them to the inventory page
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      let userRole = await getUserRole(user.uid);
      if (userRole !== "admin") {
        storeMessage(
          "Only admins are allowed access to the inventory logs.",
          "main-message",
          "error",
        );
        window.location.href = "inventory.html";
      }
    } else {
      storeMessage(
        "Only admins are allowed access to the inventory logs.",
        "main-message",
        "error",
      );
      window.location.href = "inventory.html";
    }
  });
  await loadPreviousEntries();

  //Event listener for add inventory form submit
  addInventoryModal.addEventListener("submit", (e) => {
    e.preventDefault();
    submitData();
  });

  //Event listener to open the add inventory modal
  const newDonatedEntryButton = document.getElementById(
    "newDonatedEntryButton",
  ) as HTMLElement;
  newDonatedEntryButton.addEventListener("click", () => {
    populateComponteTypeSelect("componentType");
    openModal(addInventoryModalBackdrop, addInventoryModal, "date");
  });

  //Event listener to close the add inventory modal
  const closeModalButton = document.getElementById("cancel") as HTMLElement;
  closeModalButton.addEventListener("click", () => {
    closeModal("add-inventory-backdrop");
  });
});
