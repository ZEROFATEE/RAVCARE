import './inventory.css';
import { FaRegEdit } from "react-icons/fa";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";  // ✅ Direct Tauri connection

const Inventory = () => {
    const [items, setItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("");

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [newAmount, setNewAmount] = useState("");

    const [showEditForm, setShowEditForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editedName, setEditedName] = useState("");
    const [editedAmount, setEditedAmount] = useState("");

    // ✅ Helper functions now use invoke()
    async function getInventory() {
        try {
            const data = await invoke("get_inventory");
            return data;
        } catch (err) {
            console.error("Failed to fetch inventory:", err);
            return [];
        }
    }

    async function createItem(name, amount) {
        try {
            await invoke("create_item", { name, amount });
        } catch (err) {
            console.error("Failed to create item:", err);
        }
    }

    async function editItem(id, name, amount) {
        try {
            await invoke("edit_item", { id, name, amount });
        } catch (err) {
            console.error("Failed to edit item:", err);
        }
    }

    async function deleteItem(id) {
        try {
            await invoke("delete_item", { id });
        } catch (err) {
            console.error("Failed to delete item:", err);
        }
    }

    // Load inventory when component mounts
    useEffect(() => {
        loadInventory();
    }, []);

    async function loadInventory() {
        const data = await getInventory();
        setItems(data);
    }

    async function handleCreate(e) {
        e.preventDefault();
        const amountValue = parseInt(newAmount);
        if (!newName || isNaN(amountValue) || amountValue < 0) return;

        await createItem(newName, amountValue);
        setNewName("");
        setNewAmount("");
        setShowCreateForm(false);
        loadInventory();
    }

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setEditedName(item.name);
        setEditedAmount(item.amount.toString());
        setShowEditForm(true);
    };

    const handleCloseEdit = () => {
        setShowEditForm(false);
        setEditingItem(null);
    };

    async function handleEditSubmit(e) {
        e.preventDefault();
        if (!editingItem) return;

        const amountValue = parseInt(editedAmount);
        if (!editedName || isNaN(amountValue) || amountValue < 0) return;

        await editItem(editingItem.id, editedName, amountValue);
        handleCloseEdit();
        loadInventory();
    }

    async function handleDelete() {
        if (!editingItem) return;

        const confirmation = window.confirm(
            `Are you sure you want to delete ${editingItem.name}? This action cannot be undone.`
        );
        if (confirmation) {
            await deleteItem(editingItem.id);
            handleCloseEdit();
            loadInventory();
        }
    }

    async function handleSearch(e) {
        const q = e.target.value;
        setSearchQuery(q);
        if (q.trim() === "") {
            loadInventory();
        } else {
            // Optional: Implement backend search later
            const filtered = items.filter((item) =>
                item.name.toLowerCase().includes(q.toLowerCase())
            );
            setItems(filtered);
        }
    }

    async function handleFilter(e) {
        const type = e.target.value;
        setFilterType(type);

        let sorted = [...items];
        if (type === "alphabetical") {
            sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else if (type === "amountAsc") {
            sorted.sort((a, b) => a.amount - b.amount);
        } else if (type === "amountDsc") {
            sorted.sort((a, b) => b.amount - a.amount);
        }
        setItems(sorted);
    }

    return (
        <div className="invDiv">
            <div className="container">
                <div className="searchBar flex">
                    <input
                        type="text"
                        placeholder="Search"
                        className="searchInput"
                        value={searchQuery}
                        onChange={handleSearch}
                    />

                    <select
                        className="filterDropdown"
                        value={filterType}
                        onChange={handleFilter}
                    >
                        <option value="">---</option>
                        <option value="alphabetical">Alphabetical</option>
                        <option value="amountAsc">Amount Ascending</option>
                        <option value="amountDsc">Amount Descending</option>
                    </select>

                    <button className="createBtn" onClick={() => setShowCreateForm(true)}>
                        Create
                    </button>
                </div>

                {/* Create form popup */}
                {showCreateForm && (
                    <div className="popup">
                        <form className="popupForm" onSubmit={handleCreate}>
                            <h3>Add New Item</h3>
                            <input
                                type="text"
                                placeholder="Item name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                min="0"
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                            />
                            <div className="popupActions">
                                <button type="submit">Save</button>
                                <button type="button" onClick={() => setShowCreateForm(false)}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Edit form popup */}
                {showEditForm && editingItem && (
                    <div className="popup">
                        <form className="popupForm" onSubmit={handleEditSubmit}>
                            <h3>Edit Item: {editingItem.name}</h3>
                            <input
                                type="text"
                                placeholder="Item name"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                            />
                            <input
                                type="number"
                                placeholder="Amount"
                                min="0"
                                value={editedAmount}
                                onChange={(e) => setEditedAmount(e.target.value)}
                            />
                            <div className="popupActions">
                                <button type="submit">Update</button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    style={{ backgroundColor: "red", color: "white", marginLeft: "10px" }}
                                >
                                    Delete
                                </button>
                                <button type="button" onClick={handleCloseEdit}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="invList">
                    <div className="invRow header">
                        <span>Name</span>
                        <span>Amount</span>
                        <span>Last Edited</span>
                        <span>Edit</span>
                    </div>

                    {items.map((item) => (
                        <div className="invRow" key={item.id}>
                            <span>{item.name}</span>
                            <span>{item.amount}</span>
                            <span>{item.last_edited}</span>
                            <FaRegEdit
                                className="icon"
                                onClick={() => handleOpenEdit(item)}
                                title={`Edit ${item.name}`}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Inventory;
