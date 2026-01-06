// Get elements
const cashBalanceEl = document.getElementById("cashBalance");
const gcashBalanceEl = document.getElementById("gcashBalance");
const totalProfitEl = document.getElementById("totalProfit");
const transactionForm = document.getElementById("transactionForm");
const transactionTableBody = document.querySelector("#transactionTable tbody");

// Load from localStorage or initialize
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let balances = JSON.parse(localStorage.getItem("balances")) || {cash: 0, gcash: 0, profit: 0};

// Fee tiers
function calculateFee(amount) {
  if (amount <= 100) return 5;
  if (amount <= 500) return 10;
  if (amount <= 1000) return 20;
  if (amount <= 1500) return 30;
  if (amount <= 2000) return 40;
  return Math.floor(amount / 1000) * 20; // 20 per 1k above
}

// Update summary cards
function updateSummary() {
  cashBalanceEl.textContent = `₱${balances.cash}`;
  gcashBalanceEl.textContent = `₱${balances.gcash}`;
  totalProfitEl.textContent = `₱${balances.profit}`;
}

// Render transaction table
function renderTable() {
  transactionTableBody.innerHTML = "";
  transactions.forEach(tx => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${tx.date}</td>
      <td>${tx.type}</td>
      <td>₱${tx.amount}</td>
      <td>${tx.method}</td>
      <td>₱${tx.fee}</td>
      <td>₱${tx.profit}</td>
      <td>${tx.notes}</td>
    `;
    transactionTableBody.appendChild(tr);
  });
}

// Add transaction
transactionForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const type = document.getElementById("type").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const method = document.getElementById("method").value;
  let feeInput = document.getElementById("fee").value;
  let fee = feeInput ? parseFloat(feeInput) : calculateFee(amount);
  let profit = fee;

  // Update balances
  if (type === "cashin") {
    if (method === "cash") balances.cash += amount - fee;
    else balances.gcash += amount - fee;
  } else if (type === "cashout") {
    if (method === "cash") balances.cash -= amount;
    else balances.gcash -= amount;
  }

  balances.profit += profit;

  const transaction = {
    date: new Date().toLocaleString(),
    type,
    amount,
    method,
    fee,
    profit,
    notes: document.getElementById("notes").value
  };

  transactions.push(transaction);

  // Save to localStorage
  localStorage.setItem("transactions", JSON.stringify(transactions));
  localStorage.setItem("balances", JSON.stringify(balances));

  // Update UI
  updateSummary();
  renderTable();

  transactionForm.reset();
});



        // Rebalance form
const rebalanceForm = document.getElementById("rebalanceForm");

rebalanceForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const from = document.getElementById("rebalanceFrom").value;
  const to = document.getElementById("rebalanceTo").value;
  const amount = parseFloat(document.getElementById("rebalanceAmount").value);
  const notes = document.getElementById("rebalanceNotes").value;

  if (from === to) {
    alert("Cannot transfer to the same account.");
    return;
  }

  // Check sufficient balance
  if (balances[from] < amount) {
    alert(`Insufficient balance in ${from}`);
    return;
  }

  balances[from] -= amount;
  balances[to] += amount;

  // Add a transaction record for tracking (fee = 0, profit = 0)
  const transaction = {
    date: new Date().toLocaleString(),
    type: "rebalance",
    amount,
    method: `${from}→${to}`,
    fee: 0,
    profit: 0,
    notes: notes || "Rebalance"
  };

  transactions.push(transaction);

  // Save and update
  localStorage.setItem("transactions", JSON.stringify(transactions));
  localStorage.setItem("balances", JSON.stringify(balances));

  updateSummary();
  renderTable();

  rebalanceForm.reset();
});


  
// Initial render
updateSummary();
renderTable();
