import { Timestamp } from "firebase/firestore";
import { initializeApp } from "./app";
import { getUserRole } from "./authService";
import { auth } from "./firebase";
import {
    addIemToLocation,
    addLogEntry,
    deleteLocationItemByKeys,
    deleteLogEntry,
    getAllItemsForLocation,
    getAllLogEntires,
    getListOfComponents,
    getListOfLocations,
    updateItemQuantityForLocation,
    getLocationItem
} from "./firebaseService";
import { Component, Location, InventoryEntry, LocationItem } from "./models";
import {
    closeModal,
    createButton,
    createDeleteModal,
    createMessage,
    createTable,
    createTableRow,
    fixDate,
    makeElement,
    openModal,
    storeMessage,
    createSelectList,
    createInput
} from "./modules/utils";
import { navigateTo } from "./modules/navigate";

const newEntryCard = document.getElementById('new-entry-card') as HTMLElement;
const logEntriesCard = document.getElementById('log-entries-card') as HTMLElement;
const actionButtons = document.getElementById('action-buttons') as HTMLElement;
const InventoryModalBackdrop = document.getElementById("inventory-backdrop") as HTMLElement;
let inventoryModal = document.getElementById("inventory-modal") as HTMLFormElement;

let components: Component[] = [];
let locations: Location[] = [];

initializeApp("Inventory", "Inventory Log").then(async () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            let userRole = await getUserRole(user.uid);
            if (userRole !== "admin") {
                storeMessage(
                    "Only admins are allowed access to the inventory logs.",
                    "main-message",
                    "error",
                );
                navigateTo("/inventory");
            }
        } else {
            storeMessage(
                "Only admins are allowed access to the inventory logs.",
                "main-message",
                "error",
            );
            navigateTo("/inventory");
        }
    });
    await loadInventoryEntries();
    loadNewEntryCard();
    components = await getListOfComponents();
    locations = await getListOfLocations();
    const loading = document.getElementById("loading");
    if (loading) loading.classList.add('hide');
    newEntryCard.classList.remove('hide');
    logEntriesCard.classList.remove('hide');
});

function loadNewEntryCard() {
    const cardHeading = makeElement("h2", null, null, "Add New Entry");
    newEntryCard.appendChild(cardHeading);
    const buttonRow = makeElement("section", null, "button-row", null);
    const donateItemsButton = createButton("Donate Items", "button", "donate-items-button", "secondary", "add_notes");
    donateItemsButton.addEventListener('click', () => loadDonateModal());
    buttonRow.appendChild(donateItemsButton);
    const moveItemsButton = createButton("Move Items", "button", "move-button", "secondary", "move_item");
    moveItemsButton.addEventListener('click', () => loadMoveModal());
    buttonRow.appendChild(moveItemsButton);
    const distibuteItemsButton = createButton("Distribute Items", "button", "distibute-button", "secondary", "local_shipping");
    distibuteItemsButton.addEventListener('click', () => loadDistributeModal());
    buttonRow.appendChild(distibuteItemsButton);
    newEntryCard.appendChild(buttonRow);
}

function addNewRow(newEntry: InventoryEntry) {
    //Create a new row for the table with the entry details
    const keysToDisplay = [
        "entryDate",
        "entry"
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
                            await deleteLogEntry(newEntry["entryId"]);
                            if (newEntry['locationName'] && newEntry['destination'] && !newEntry['external']) {
                                //Move items back to old location
                                const originalLocation = locations.find(location => location['locationName'] === newEntry['locationName']);
                                if (originalLocation) {
                                    const itemToRemoveFrom = await getLocationItem(newEntry['locationId'], newEntry['componentId']);
                                    if (itemToRemoveFrom) {
                                        const loweredQuantity = itemToRemoveFrom['quantity'] - newEntry['quantity'];
                                        if (loweredQuantity === 0) {
                                            //remove the item from the location
                                            await deleteLocationItemByKeys(newEntry['locationId'], newEntry['componentId']);
                                        } else {
                                            //update the item quantity
                                            itemToRemoveFrom['quantity'] = loweredQuantity;
                                            await updateItemQuantityForLocation(itemToRemoveFrom);
                                        }
                                    }
                                    const itemToUpdate = await getLocationItem(originalLocation['locationId'], newEntry['componentId']);
                                    if (itemToUpdate) {
                                        //update the quantity in the old location
                                        const updatedQuantity = itemToUpdate['quantity'] + newEntry['quantity'];
                                        itemToUpdate['quantity'] = updatedQuantity;
                                        await updateItemQuantityForLocation(itemToUpdate);
                                    } else {
                                        const itemToReturn: LocationItem = {
                                            locationId: originalLocation['locationId'],
                                            locationName: originalLocation['locationName'],
                                            componentId: newEntry['componentId'],
                                            componentType: newEntry['componentType'],
                                            quantity: newEntry['quantity']
                                        }
                                        await addIemToLocation(itemToReturn);
                                    }
                                }
                            } else if (newEntry['external']) {
                                //Add quantity back to item from distribution
                                const itemToUpdate = await getLocationItem(newEntry['locationId'], newEntry['componentId']);
                                if (itemToUpdate) {
                                    //Update the quantity
                                    itemToUpdate['quantity'] = itemToUpdate['quantity'] + newEntry['quantity'];
                                    await updateItemQuantityForLocation(itemToUpdate);
                                } else {
                                    //Add the item back to the location
                                    const itemToAdd: LocationItem = {
                                        locationId: newEntry['locationId'],
                                        locationName: newEntry['locationName'],
                                        componentId: newEntry['componentId'],
                                        componentType: newEntry['componentType'],
                                        quantity: newEntry['quantity']
                                    }
                                    await addIemToLocation(itemToAdd)
                                }
                            } else {
                                //Reduce quantity from donation
                                const itemToUpdate = await getLocationItem(newEntry['locationId'], newEntry['componentId']);
                                if (itemToUpdate) {
                                    const updatedQuantity = itemToUpdate['quantity'] - newEntry['quantity'];
                                    if (updatedQuantity === 0) {
                                        //Remove the item from the locaiton
                                        await deleteLocationItemByKeys(newEntry['locationId'], newEntry['componentId']);
                                    } else {
                                        //Lower the quantity
                                        itemToUpdate['quantity'] = updatedQuantity;
                                        console.log(itemToUpdate);
                                        await updateItemQuantityForLocation(itemToUpdate);
                                    }
                                }
                            }
                            //Create a message saying the log entry has been deleted
                            createMessage(
                                `Deleted entry ${newEntry["quantity"]} ${newEntry["componentType"]} from ${newEntry['locationName']}`,
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

async function loadInventoryEntries() {
    try {
        const cardHeading = makeElement("h2", null, null, "Inventory Log");
        logEntriesCard.appendChild(cardHeading);
        const logEntries = await getAllLogEntires();
        if (logEntries.length === 0) {
            const noEntriesP = makeElement("p", null, null, "No log entires");
            logEntriesCard.appendChild(noEntriesP);
        } else {
            const tableColumnHeaders: string[] = [
                "Date",
                "Entry",
                "Delete"
            ];
            const entriesTableContainer = document.getElementById("entries-table-container");
            if (entriesTableContainer) entriesTableContainer.remove();
            const tableContainer = makeElement("div", "entries-table-container", "table-container", null);
            const entiresTable = createTable("entries-table", tableColumnHeaders);
            let tableBody = logEntries.reduce((acc: HTMLElement, currentEntry: InventoryEntry) => {
                const newRow = addNewRow(currentEntry);
                acc.appendChild(newRow);
                return acc;
            }, document.createElement('tbody'));
            tableBody.setAttribute('id', 'entries-table-body');
            entiresTable.appendChild(tableBody);
            tableContainer.appendChild(entiresTable);
            logEntriesCard.appendChild(tableContainer);
        }
    } catch (error: any) {
        createMessage(error, "main-message", "error");
    }
}

async function loadDonateModal() {
    inventoryModal.innerHTML = '';
    const newForm = inventoryModal.cloneNode(true) as HTMLFormElement;
    inventoryModal.parentNode?.replaceChild(newForm, inventoryModal);
    inventoryModal = newForm;
    const formHeading = makeElement("h2", null, null, "Donate Items");
    inventoryModal.appendChild(formHeading);
    //Who Donated
    const whoDonated = createInput("text", "who-donated", "Your name:", "form-row");
    inventoryModal.appendChild(whoDonated);
    //Date
    const dateInput = createInput("date", "date", "Date entered:", "form-row");
    inventoryModal.appendChild(dateInput);
    //Componet Type select
    const componetTypeRow = makeElement("section", null, "form-row", null);
    const componentLabel = makeElement("label", null, null, "Select component type:");
    componentLabel.setAttribute("for", "component-select");
    const compnentSelect = createSelectList(components, "component", "component-select", null);
    componetTypeRow.appendChild(componentLabel);
    componetTypeRow.appendChild(compnentSelect);
    inventoryModal.appendChild(componetTypeRow);
    //Location select
    const locationRow = makeElement("section", null, "form-row", null);
    const locationLabel = makeElement("label", null, null, "Select location:");
    locationLabel.setAttribute("for", "location-select");
    const locationSelect = createSelectList(locations, "location", "location-select", "internal");
    locationRow.appendChild(locationLabel);
    locationRow.appendChild(locationSelect);
    inventoryModal.appendChild(locationRow);
    //Quantity
    const quantityInput = createInput("number", "quantity", "Quantity:", "form-row")
    inventoryModal.appendChild(quantityInput);
    //Form Buttons
    const formButtons = makeElement("section", null, "button-row", null);
    const cancelButton = createButton("Cancel", "button", "cancel", "secondary");
    cancelButton.addEventListener('click', () => closeModal("inventory-backdrop"));
    formButtons.appendChild(cancelButton);
    const submitButton = createButton("Submit", "submit", "submit-donate", "primary") as HTMLButtonElement;
    formButtons.appendChild(submitButton);
    inventoryModal.appendChild(formButtons);
    inventoryModal.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        const formData: FormData = new FormData(inventoryModal);
        await submitDonatedData(formData);
    });
    openModal(InventoryModalBackdrop, inventoryModal, "who-donated");
}

async function submitDonatedData(formData: FormData) {
    let newLogEntry: InventoryEntry = {
        entryId: "",
        entryDate: Timestamp.fromDate(new Date(0)),
        componentId: "",
        locationId: "",
        locationName: "",
        componentType: "",
        quantity: 0,
        whoDonated: "",
        external: false
    }
    const whoDonatedInput = formData.get('who-donated');
    if (whoDonatedInput === null || whoDonatedInput.toString().trim() === "") {
        createMessage("Please enter your name", "modal-message", "error");
        return;
    } else {
        newLogEntry['whoDonated'] = whoDonatedInput.toString();
    }
    const dateEntered = formData.get('date');
    if (dateEntered === null || dateEntered === "") {
        createMessage("Please select the date entered", "modal-message", "error");
        return;
    } else {
        const jsDate = new Date(dateEntered.toString());
        newLogEntry['entryDate'] = Timestamp.fromDate(jsDate);
    }
    const selectedLocationId = formData.get('location');
    const selectedComponentId = formData.get('component');
    if (selectedComponentId === null) {
        createMessage("Please select a component.", "modal-message", "error");
        return;
    } else {
        const selectedComponent: Component | undefined = components.find(component => component['componentId'] === selectedComponentId);
        if (selectedComponent) {
            newLogEntry['componentId'] = selectedComponentId.toString();
            newLogEntry['componentType'] = selectedComponent['componentType'];
        }
    }
    if (selectedLocationId === null) {
        createMessage("Please select a location.", "modal-message", "error");
        return;
    } else {
        const selectedLocation: Location | undefined = locations.find(location => location['locationId'] === selectedLocationId);
        if (selectedLocation) {
            newLogEntry['locationId'] = selectedLocationId.toString();
            newLogEntry['locationName'] = selectedLocation['locationName'];
        }
    }
    const quantityInput = formData.get('quantity');
    if (quantityInput === null) {
        createMessage("Please enter the quantity", "modal-message", "error");
        return;
    } else {
        const quantityValue: number = +quantityInput;
        if (quantityValue < 1) {
            createMessage("Please enter a quantity greater than 0", "modal-message", "error");
            return;
        } else {
            newLogEntry['quantity'] = quantityValue;
        }
    }
    createMessage("Submitting Data...", "modal-message", "info");
    try {
        const itemsAtLocation = await getAllItemsForLocation(newLogEntry['locationId']);
        const itemAtLocation = itemsAtLocation.find(item => item['componentId'] === newLogEntry['componentId']);
        if (itemAtLocation) {
            const newQuantity = itemAtLocation['quantity'] + newLogEntry['quantity'];
            itemAtLocation['quantity'] = newQuantity;
            await updateItemQuantityForLocation(itemAtLocation);
            closeModal("inventory-backdrop");
            const entryIdReturned = await addLogEntry(newLogEntry);
            newLogEntry['entryId'] = entryIdReturned;
            createMessage(`${newLogEntry['componentType']} quantity updated at ${newLogEntry['locationName']}`, "main-message", "check_circle");
            const entiresTableBody = document.getElementById('entries-table-body');
            if (entiresTableBody) {
                const newRow = addNewRow(newLogEntry);
                entiresTableBody.prepend(newRow);
            } else {
                await loadInventoryEntries();
            }
            const submitButton = document.querySelector('#submit-donate') as HTMLButtonElement;
            if (submitButton) submitButton.disabled = false;
        } else {
            if (newLogEntry['locationName']) {
                const itemToAddToLocation: LocationItem = {
                    locationId: newLogEntry['locationId'],
                    locationName: newLogEntry['locationName'],
                    componentId: newLogEntry['componentId'],
                    componentType: newLogEntry['componentType'],
                    quantity: newLogEntry['quantity']
                }
                await addIemToLocation(itemToAddToLocation);
                const entryIdReturned = await addLogEntry(newLogEntry);
                newLogEntry['entryId'] = entryIdReturned;
                closeModal("inventory-backdrop");
                createMessage(`${newLogEntry['componentType']} added to ${newLogEntry['locationName']}`, "main-message", "check_circle");
            }
            const entiresTableBody = document.getElementById('entries-table-body');
            if (entiresTableBody) {
                const newRow = addNewRow(newLogEntry);
                entiresTableBody.prepend(newRow);
            } else {
                await loadInventoryEntries();
            }
            const submitButton = document.querySelector('#submit-donate') as HTMLButtonElement;
            if (submitButton) submitButton.disabled = false;
        }
    } catch (error: any) {
        createMessage(error, "main-message", "error");
        const submitButton = document.querySelector('#submit-donate') as HTMLButtonElement;
        if (submitButton) submitButton.disabled = false;
    }
}

async function loadMoveModal() {
    inventoryModal.innerHTML = '';
    const newForm = inventoryModal.cloneNode(true) as HTMLFormElement;
    inventoryModal.parentNode?.replaceChild(newForm, inventoryModal);
    inventoryModal = newForm;
    const formHeading = makeElement("h2", null, null, "Move Items");
    inventoryModal.appendChild(formHeading);
    //Who Donated
    const whoDonated = createInput("text", "who-donated", "Your name:", "form-row");
    inventoryModal.appendChild(whoDonated);
    //Date
    const dateInput = createInput("date", "date", "Date entered:", "form-row");
    inventoryModal.appendChild(dateInput);
    //Location select
    const currentLocationRow = makeElement("section", null, "form-row", null);
    const currentLocationLabel = makeElement("label", null, null, "Select current location:");
    currentLocationLabel.setAttribute("for", "current-location-select");
    const currentLocationSelect = createSelectList(locations, "location", "current-location-select", "internal");
    currentLocationRow.appendChild(currentLocationLabel);
    currentLocationRow.appendChild(currentLocationSelect);
    inventoryModal.appendChild(currentLocationRow);
    //New Location select
    const newLocationRow = makeElement("section", "new-location-row", "form-row hide", null);
    inventoryModal.appendChild(newLocationRow);
    //Componet row
    const componetTypeRow = makeElement("section", null, "form-row", null);
    inventoryModal.appendChild(componetTypeRow);
    //Quantity
    const quantityInput = createInput("number", "quantity", "Quantity:", "form-row hide")
    inventoryModal.appendChild(quantityInput);
    //Form Buttons
    const formButtons = makeElement("section", null, "button-row", null);
    const cancelButton = createButton("Cancel", "button", "cancel", "secondary");
    cancelButton.addEventListener('click', () => closeModal("inventory-backdrop"));
    formButtons.appendChild(cancelButton);
    const submitButton = createButton("Submit", "submit", "submit", "primary hide");
    formButtons.appendChild(submitButton);
    inventoryModal.appendChild(formButtons);
    let selectedComponentObject: LocationItem | undefined = undefined;
    currentLocationSelect.addEventListener('change', async (e) => {
        e.preventDefault();
        newLocationRow.classList.add('hide');
        quantityInput.classList.add('hide');
        newLocationRow.classList.add('hide');
        submitButton.classList.add('hide');
        componetTypeRow.innerHTML = '';
        newLocationRow.innerHTML = '';
        const target = e.target as HTMLSelectElement;
        const selectedLocation = target.value;
        //Componet Type select
        const componentsAtLocation = await getAllItemsForLocation(selectedLocation);
        if (componentsAtLocation.length === 0) {
            const noItemsP = makeElement("p", null, null, "Please choose a different location");
            componetTypeRow.appendChild(noItemsP);
        } else {
            const newComponetSelect = createSelectList(componentsAtLocation, "component", "component-select", null);
            newComponetSelect.addEventListener('change', (e) => {
                e.preventDefault();
                const target = e.target as HTMLSelectElement;
                const selectedComponentId = target.value;
                selectedComponentObject = componentsAtLocation.find(item => item['componentId'] === selectedComponentId)
            })
            const componentLabel = makeElement("label", null, null, "Select component type:");
            componentLabel.setAttribute("for", "component-select");
            componetTypeRow.appendChild(componentLabel);
            componetTypeRow.appendChild(newComponetSelect);
            //filter out current location
            const newLocationLabel = makeElement("label", null, null, "Select new location:");
            newLocationLabel.setAttribute("for", "new-location-select");
            const filteredLocations = locations.filter(location => location['locationId'] !== selectedLocation);
            const newLocationSelect = createSelectList(filteredLocations, "location", "new-location-select", "internal");
            newLocationRow.appendChild(newLocationLabel);
            newLocationRow.appendChild(newLocationSelect);
            newLocationRow.classList.remove('hide');
            quantityInput.classList.remove('hide');
            newLocationRow.classList.remove('hide');
            submitButton.classList.remove('hide');
        }
    });
    inventoryModal.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData: FormData = new FormData(inventoryModal);
        await submitMoveData(formData, selectedComponentObject);
    });
    openModal(InventoryModalBackdrop, inventoryModal, "who-donated");
}

async function submitMoveData(formData: FormData, selectedComponentObject: LocationItem | undefined) {
    let newLogEntry: InventoryEntry = {
        entryId: "",
        entryDate: Timestamp.fromDate(new Date(0)),
        componentId: "",
        locationId: "",
        locationName: "",
        componentType: "",
        quantity: 0,
        whoDonated: "",
        destination: "",
        external: false
    }
    const whoDonatedInput = formData.get('who-donated');
    if (whoDonatedInput === null || whoDonatedInput.toString().trim() === "") {
        createMessage("Please enter your name", "modal-message", "error");
        return;
    } else {
        newLogEntry['whoDonated'] = whoDonatedInput.toString();
    }
    const dateEntered = formData.get('date');
    if (dateEntered === null || dateEntered === "") {
        createMessage("Please select the date entered", "modal-message", "error");
        return;
    } else {
        const jsDate = new Date(dateEntered.toString());
        newLogEntry['entryDate'] = Timestamp.fromDate(jsDate);
    }
    const currentLocationSelect = document.getElementById('current-location-select') as HTMLSelectElement;
    const newLocationSelect = document.getElementById('new-location-select') as HTMLSelectElement;
    const currentLocationValue = currentLocationSelect.value;
    const newLocationValue = newLocationSelect.value;
    if (currentLocationValue === null || currentLocationValue.toString().trim() === "") {
        createMessage("Please select the current location", "modal-message", "error");
        return;
    } else {
        const currentLocationObject = locations.find(location => location['locationId'] === currentLocationValue);
        if (currentLocationObject) {
            newLogEntry['locationName'] = currentLocationObject['locationName'];
        }
    }
    if (newLocationValue === null || newLocationValue.toString().trim() === "") {
        createMessage("Please select the new location", "modal-message", "error");
        return;
    } else {
        const newLocationObject = locations.find(location => location['locationId'] === newLocationValue);
        if (newLocationObject) {
            newLogEntry['locationId'] = newLocationValue;
            newLogEntry['destination'] = newLocationObject['locationName'];
        }
    }
    const quantityInput = formData.get('quantity');
    if (quantityInput === null) {
        createMessage("Please enter the quantity", "modal-message", "error");
        return;
    } else {
        const quantityValue: number = +quantityInput;
        if (quantityValue < 1) {
            createMessage("Please enter a quantity greater than 0", "modal-message", "error");
            return;
        } else {
            if (selectedComponentObject) {
                if (quantityValue > selectedComponentObject['quantity']) {
                    createMessage(`Please enter a quantity less than ${selectedComponentObject['quantity']}`, "modal-message", "error");
                    return;
                } else {
                    newLogEntry['quantity'] = quantityValue;
                }
            }

        }
    }
    const selectedComponentId = formData.get('component');
    if (selectedComponentId === null) {
        createMessage("Please select a component.", "modal-message", "error");
        return;
    } else {
        const selectedComponent: Component | undefined = components.find(component => component['componentId'] === selectedComponentId);
        if (selectedComponent) {
            newLogEntry['componentId'] = selectedComponentId.toString();
            newLogEntry['componentType'] = selectedComponent['componentType'];
        }
    }
    closeModal("inventory-backdrop");
    createMessage("Submitting Data...", "main-message", "info");
    try {
        if (selectedComponentObject) {
            selectedComponentObject['quantity'] = selectedComponentObject['quantity'] - newLogEntry['quantity'];
            if (selectedComponentObject['quantity'] === 0) {
                await deleteLocationItemByKeys(selectedComponentObject['locationId'], selectedComponentObject['componentId']);
            } else {
                await updateItemQuantityForLocation(selectedComponentObject);
            }
            const itemsAtNewLocation = await getAllItemsForLocation(newLogEntry['locationId']);
            const itemAtNewLocation = itemsAtNewLocation.find(item => item['componentId'] === newLogEntry['componentId']);
            const itemForNewLocation: LocationItem = {
                locationId: newLogEntry['locationId'],
                locationName: newLogEntry['destination'] as string,
                componentId: selectedComponentObject['componentId'],
                componentType: selectedComponentObject['componentType'],
                quantity: +quantityInput
            }
            if (itemAtNewLocation) {
                await updateItemQuantityForLocation(itemForNewLocation);
            } else {
                await addIemToLocation(itemForNewLocation);
            }
            const entryIdReturned = await addLogEntry(newLogEntry);
            newLogEntry['entryId'] = entryIdReturned;
            const entiresTableBody = document.getElementById('entries-table-body');
            if (entiresTableBody) {
                const newRow = addNewRow(newLogEntry);
                entiresTableBody.prepend(newRow);
            } else {
                await loadInventoryEntries();
            }
            createMessage(`Moved ${itemForNewLocation['quantity']} ${itemForNewLocation['componentType']} from ${newLogEntry['locationName']} to ${newLogEntry['destination']}`, "main-message", "check_circle");
        }
    } catch (error: any) {
        createMessage(error, "main-message", "error");
    }
}

async function loadDistributeModal() {
    inventoryModal.innerHTML = '';
    const newForm = inventoryModal.cloneNode(true) as HTMLFormElement;
    inventoryModal.parentNode?.replaceChild(newForm, inventoryModal);
    inventoryModal = newForm;
    const formHeading = makeElement("h2", null, null, "Distibute Items");
    inventoryModal.appendChild(formHeading);
    //Who Donated
    const whoDonated = createInput("text", "who-donated", "Your name:", "form-row");
    inventoryModal.appendChild(whoDonated);
    //Date
    const dateInput = createInput("date", "date", "Date entered:", "form-row");
    inventoryModal.appendChild(dateInput);
    //Location select
    const currentLocationRow = makeElement("section", null, "form-row", null);
    const currentLocationLabel = makeElement("label", null, null, "Select current location:");
    currentLocationLabel.setAttribute("for", "current-location-select");
    const currentLocationSelect = createSelectList(locations, "location", "current-location-select", "internal");
    currentLocationRow.appendChild(currentLocationLabel);
    currentLocationRow.appendChild(currentLocationSelect);
    inventoryModal.appendChild(currentLocationRow);
    //New Location select
    const newLocationRow = makeElement("section", "new-location-row", "form-row hide", null);
    inventoryModal.appendChild(newLocationRow);
    //Componet row
    const componetTypeRow = makeElement("section", null, "form-row", null);
    inventoryModal.appendChild(componetTypeRow);
    //Quantity
    const quantityInput = createInput("number", "quantity", "Quantity:", "form-row hide")
    inventoryModal.appendChild(quantityInput);
    //Form Buttons
    const formButtons = makeElement("section", null, "button-row", null);
    const cancelButton = createButton("Cancel", "button", "cancel", "secondary");
    cancelButton.addEventListener('click', () => closeModal("inventory-backdrop"));
    formButtons.appendChild(cancelButton);
    const submitButton = createButton("Submit", "submit", "submit", "primary hide");
    formButtons.appendChild(submitButton);
    inventoryModal.appendChild(formButtons);
    let selectedComponentObject: LocationItem | undefined = undefined;
    currentLocationSelect.addEventListener('change', async (e) => {
        e.preventDefault();
        newLocationRow.classList.add('hide');
        quantityInput.classList.add('hide');
        newLocationRow.classList.add('hide');
        submitButton.classList.add('hide');
        componetTypeRow.innerHTML = '';
        newLocationRow.innerHTML = '';
        const target = e.target as HTMLSelectElement;
        const selectedLocation = target.value;
        //Componet Type select
        const componentsAtLocation = await getAllItemsForLocation(selectedLocation);
        if (componentsAtLocation.length === 0) {
            const noItemsP = makeElement("p", null, null, "Please choose a different location");
            componetTypeRow.appendChild(noItemsP);
        } else {
            const newComponetSelect = createSelectList(componentsAtLocation, "component", "component-select", null);
            newComponetSelect.addEventListener('change', (e) => {
                e.preventDefault();
                const target = e.target as HTMLSelectElement;
                const selectedComponentId = target.value;
                selectedComponentObject = componentsAtLocation.find(item => item['componentId'] === selectedComponentId)
            })
            const componentLabel = makeElement("label", null, null, "Select component type:");
            componentLabel.setAttribute("for", "component-select");
            componetTypeRow.appendChild(componentLabel);
            componetTypeRow.appendChild(newComponetSelect);
            const newLocationLabel = makeElement("label", null, null, "Select destination:");
            newLocationLabel.setAttribute("for", "destination-select");
            const newLocationSelect = createSelectList(locations, "destination", "destination-select", "external");
            newLocationRow.appendChild(newLocationLabel);
            newLocationRow.appendChild(newLocationSelect);
            newLocationRow.classList.remove('hide');
            quantityInput.classList.remove('hide');
            newLocationRow.classList.remove('hide');
            submitButton.classList.remove('hide');
        }
    });
    inventoryModal.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData: FormData = new FormData(inventoryModal);
        await submitDistibuteData(formData, selectedComponentObject);
    });
    openModal(InventoryModalBackdrop, inventoryModal, "who-donated");
}

async function submitDistibuteData(formData: FormData, selectedComponentObject: LocationItem | undefined) {
    let newLogEntry: InventoryEntry = {
        entryId: "",
        entryDate: Timestamp.fromDate(new Date(0)),
        componentId: "",
        locationId: "",
        locationName: "",
        componentType: "",
        quantity: 0,
        whoDonated: "",
        destination: "",
        external: true
    }
    const whoDonatedInput = formData.get('who-donated');
    if (whoDonatedInput === null || whoDonatedInput.toString().trim() === "") {
        createMessage("Please enter your name", "modal-message", "error");
        return;
    } else {
        newLogEntry['whoDonated'] = whoDonatedInput.toString();
    }
    const dateEntered = formData.get('date');
    if (dateEntered === null || dateEntered === "") {
        createMessage("Please select the date entered", "modal-message", "error");
        return;
    } else {
        const jsDate = new Date(dateEntered.toString());
        newLogEntry['entryDate'] = Timestamp.fromDate(jsDate);
    }
    const currentLocationSelect = document.getElementById('current-location-select') as HTMLSelectElement;
    const currentLocationValue = currentLocationSelect.value;
    const newLocationValue = formData.get('destination');
    if (currentLocationValue === null || currentLocationValue.toString().trim() === "") {
        createMessage("Please select the current location", "modal-message", "error");
        return;
    } else {
        const currentLocationObject = locations.find(location => location['locationId'] === currentLocationValue);
        if (currentLocationObject) {
            newLogEntry['locationName'] = currentLocationObject['locationName'];
        }
    }
    if (newLocationValue === null || newLocationValue.toString().trim() === "") {
        createMessage("Please select the destination", "modal-message", "error");
        return;
    } else {
        const newLocationObject = locations.find(location => location['locationId'] === newLocationValue);
        if (newLocationObject) {
            newLogEntry['locationId'] = newLocationValue.toString();
            newLogEntry['destination'] = newLocationObject['locationName'];
        }
    }
    const quantityInput = formData.get('quantity');
    if (quantityInput === null) {
        createMessage("Please enter the quantity", "modal-message", "error");
        return;
    } else {
        const quantityValue: number = +quantityInput;
        if (quantityValue < 1) {
            createMessage("Please enter a quantity greater than 0", "modal-message", "error");
            return;
        } else {
            if (selectedComponentObject) {
                if (quantityValue > selectedComponentObject['quantity']) {
                    createMessage(`Please enter a quantity less than ${selectedComponentObject['quantity']}`, "modal-message", "error");
                    return;
                } else {
                    newLogEntry['quantity'] = quantityValue;
                }
            }

        }
    }
    const selectedComponentId = formData.get('component');
    if (selectedComponentId === null) {
        createMessage("Please select a component.", "modal-message", "error");
        return;
    } else {
        const selectedComponent: Component | undefined = components.find(component => component['componentId'] === selectedComponentId);
        if (selectedComponent) {
            newLogEntry['componentId'] = selectedComponentId.toString();
            newLogEntry['componentType'] = selectedComponent['componentType'];
        }
    }
    closeModal("inventory-backdrop");
    createMessage("Submitting Data...", "main-message", "info");
    try {
        if (selectedComponentObject) {
            selectedComponentObject['quantity'] = selectedComponentObject['quantity'] - newLogEntry['quantity'];
            if (selectedComponentObject['quantity'] === 0) {
                await deleteLocationItemByKeys(selectedComponentObject['locationId'], selectedComponentObject['componentId']);
            } else {
                await updateItemQuantityForLocation(selectedComponentObject);
            }
            const entryIdReturned = await addLogEntry(newLogEntry);
            newLogEntry['entryId'] = entryIdReturned;
            const entiresTableBody = document.getElementById('entries-table-body');
            if (entiresTableBody) {
                const newRow = addNewRow(newLogEntry);
                entiresTableBody.prepend(newRow);
            } else {
                await loadInventoryEntries();
            }
            createMessage(`Distributed ${newLogEntry['quantity']} ${newLogEntry['componentType']} from ${newLogEntry['locationName']} to ${newLogEntry['destination']}`, "main-message", "check_circle");
        }
    } catch (error: any) {
        createMessage(error, "main-message", "error");
    }

}