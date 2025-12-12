import { Timestamp } from "firebase/firestore";
import {
  createTableRow,
  createTable,
  createMessage,
  storeMessage,
  createDeleteModal,
  openModal,
  closeModal,
  fixDate,
  populateComponteTypeSelect,
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
const distributeInventoryModal = document.getElementById(
  "distribute-inventory-modal",
) as HTMLFormElement;
const distributeInventoryBackdrop = document.getElementById(
  "distribute-inventory-backdrop",
) as HTMLElement;
const previousEntriesCard = document.getElementById(
  "previous-entries-card",
) as HTMLElement;

function addNewRow(newEntry: InventoryEntry) {
  //Create a new row for the table with the entry details
  const keysToDisplay = [
    "entryDate",
    "componentType",
    "quantity",
    "destination",
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
            //Delete the log entry
            try {
              await deleteLogEntry(newEntry["entryId"]);
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
  let distributedInventoryData: InventoryEntry[] = [];
  try {
    distributedInventoryData = await getFilteredLogEntries("distributed");
    // distributedInventoryData = await getAllLogEntires();
  } catch (error) {
    createMessage(
      "Error loading log entries. Please try reloading the page",
      "main-message",
      "error",
    );
  }

  if (distributedInventoryData.length === 0) {
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
      "Destination",
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
    let tableBody = distributedInventoryData.reduceRight(
      (acc: HTMLElement, currentItem: InventoryEntry) => {
        //Create a row for the current item
        const newRow = addNewRow(currentItem);
        acc.appendChild(newRow);
        return acc;
      },
      document.createElement("tbody"),
    );
    tableBody.setAttribute("id", "distributedTableBody");
    previousEntriesTable.appendChild(tableBody);
    tableContainer.appendChild(previousEntriesTable);
    previousEntriesCard.appendChild(tableContainer);
  }
  const newDistributedEntryButton = document.getElementById(
    "newDistributedEntryButton",
  ) as HTMLElement;
  const loadingCard = document.getElementById("loading");
  //Remove the loading card and show the previous log entries and the distribute inventory button
  if (loadingCard) loadingCard.remove();
  if (newDistributedEntryButton.classList.contains("hide"))
    newDistributedEntryButton.classList.remove("hide");
  if (previousEntriesCard.classList.contains("hide"))
    previousEntriesCard.classList.remove("hide");
}

async function submitData() {
  //Create a 'submitting data' message while the app validates and submits the entry log
  createMessage(
    "Submitting entry log data...",
    "distribute-modal-message",
    "info",
  );
  //Get the data from the form
  const distributedFormData: FormData = new FormData(distributeInventoryModal);
  //Create an object for the entry
  let newEntry: InventoryEntry = {
    entryId: "",
    entryDate: Timestamp.fromDate(new Date(0)),
    componentType: "",
    quantity: 0,
    destination: "",
  };
  //Validate date input
  const dateValue = distributedFormData.get("date");
  if (dateValue === null || dateValue === "") {
    createMessage(
      "Please enter the date the components are leaving",
      "distribute-modal-message",
      "error",
    );
    return;
  } else {
    const jsDate = new Date(dateValue.toString());
    newEntry["entryDate"] = Timestamp.fromDate(jsDate);
  }
  //Validate component type selected input
  const componentTypeValue = distributedFormData.get("componentType");
  if (
    componentTypeValue === null ||
    componentTypeValue.toString().trim() === ""
  ) {
    createMessage(
      "Please select what component you are distributing",
      "distribute-modal-message",
      "error",
    );
    return;
  } else {
    newEntry["componentType"] = componentTypeValue.toString();
  }

  //Validate quantity input
  const quantityValue = distributedFormData.get("quantity");
  if (quantityValue === null) {
    createMessage(
      "Please enter the quantity of the components being distributed",
      "distribute-modal-message",
      "error",
    );
    return;
  } else {
    const quantity: number = +quantityValue;
    if (quantity < 1) {
      createMessage(
        "Please enter a quantity greater that 0",
        "distribute-modal-message",
        "error",
      );
      return;
    } else {
      newEntry["quantity"] = quantity;
    }
  }
  //Validate destination input
  const destinationValue = distributedFormData.get("destination");
  if (destinationValue === null || destinationValue.toString().trim() === "") {
    createMessage(
      "Please enter the destination",
      "distribute-modal-message",
      "error",
    );
    return;
  } else {
    newEntry["destination"] = destinationValue.toString();
  }
  //Submit the entry
  try {
    let entryId = await addLogEntry(newEntry);
    if (entryId) {
      newEntry["entryId"] = entryId;
    }
    closeModal("distribute-inventory-backdrop");
    createMessage(
      "The inventory has successfully been updated",
      "main-message",
      "check_circle",
    );
    //Clear the form
    distributeInventoryModal.reset();
    //Get the distributed log table body
    const distributedTableBody = document.getElementById(
      "distributedTableBody",
    );
    if (distributedTableBody) {
      //If the table body exists, add the new row to the top of the table
      const newRow = addNewRow(newEntry);
      distributedTableBody.prepend(newRow);
    } else {
      //If the table body does not exist, create/load the table
      loadPreviousEntries();
    }
  } catch (error: any) {
    createMessage(error, "distribute-modal-message", "error");
  }
}

initializeApp("Inventory", "Distributed Inventory").then(async () => {
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
    await loadPreviousEntries();

    //Event listener for distribute inventory form submit
    distributeInventoryModal.addEventListener("submit", (e) => {
      e.preventDefault();
      submitData();
    });

    //Event listener to open the distribute inventory modal
    const openModalButton = document.getElementById(
      "newDistributedEntryButton",
    ) as HTMLElement;
    openModalButton.addEventListener("click", () => {
      populateComponteTypeSelect("componentType");
      openModal(distributeInventoryBackdrop, distributeInventoryModal, "date");
    });

    //Event listener to close the distribute inventory modal
    const closeModalButton = document.getElementById("cancel") as HTMLElement;
    closeModalButton.addEventListener("click", () =>
      closeModal("distribute-inventory-backdrop"),
    );
  });
});
