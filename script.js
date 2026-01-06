// Elements
const tablinks = document.querySelectorAll(".tablink");
const tabcontents = document.querySelectorAll(".tabcontent");

const dashCashEl = document.getElementById("dashCash");
const dashGcashEl = document.getElementById("dashGcash");
const dashProfitEl = document.getElementById("dashProfit");
const dailyEl = document.getElementById("dailyTotal");
const weeklyEl = document.getElementById("weeklyTotal");
const monthlyEl = document.getElementById("monthlyTotal");
const yearlyEl = document.getElementById("yearlyTotal");

const transactionForm = document.getElementById("transactionForm");
const transactionTableBody = document.querySelector("#transactionTable tbody");

const rebalanceForm = document.getElementById("rebalanceForm");

// Load data
let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let balances = JSON.parse(localStorage.getItem("balances")) || {cash:0, gcash:0, profit:0};

// Tabs
function openTab(tabName) {
  tabcontents.forEach(tc => tc.classList.remove("active"));
  tablinks.forEach(tl => tl.classList.remove("active"));
  document.getElementById(tabName).classList.add("active");
  document.querySelector(`.tablink[onclick="openTab('${tabName}')"]`).classList.add("active");
}

// Fee tiers
function calculateFee(amount) {
  if(amount <= 100) return 5;
  if(amount <= 500) return 10;
  if(amount <= 1000) return 20;
  if(amount <= 1500) return 30;
  if(amount <= 2000) return 40;
  return Math.floor(amount/1000)*20;
}

// Update summary cards
function updateSummary() {
  dashCashEl.textContent = `₱${balances.cash}`;
  dashGcashEl.textContent = `₱${balances.gcash}`;
  dashProfitEl.textContent = `₱${balances.profit}`;
  updateDashboardTotals();
}

// Render table
function renderTable() {
  transactionTableBody.innerHTML = "";
  transactions.forEach(tx => {
    const tr = document.createElement("tr");
    if(tx.type === "rebalance") {
      tr.style.backgroundColor = "#fff3cd";
      tr.style.fontStyle = "italic";
    }
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

// Transaction form submit
transactionForm.addEventListener("submit", e=>{
  e.preventDefault();
  const type = document.getElementById("type").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const method = document.getElementById("method").value;
  let feeInput = document.getElementById("fee").value;
  let fee = feeInput ? parseFloat(feeInput) : calculateFee(amount);
  let profit = fee;

  if(type==="cashin"){
    if(method==="cash") balances.cash += amount - fee;
    else balances.gcash += amount - fee;
  } else if(type==="cashout"){
    if(method==="cash") balances.cash -= amount;
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
  saveAndUpdate();
  transactionForm.reset();
});

// Rebalance submit
rebalanceForm.addEventListener("submit", e=>{
  e.preventDefault();
  const from = document.getElementById("rebalanceFrom").value;
  const to = document.getElementById("rebalanceTo").value;
  const amount = parseFloat(document.getElementById("rebalanceAmount").value);
  const notes = document.getElementById("rebalanceNotes").value;

  if(from===to){ alert("Cannot transfer to same account."); return; }
  if(balances[from]<amount){ alert(`Insufficient balance in ${from}`); return; }

  balances[from]-=amount;
  balances[to]+=amount;

  const transaction = {
    date: new Date().toLocaleString(),
    type:"rebalance",
    amount,
    method:`${from}→${to}`,
    fee:0,
    profit:0,
    notes: notes || "Rebalance"
  };
  transactions.push(transaction);
  saveAndUpdate();
  rebalanceForm.reset();
});

// Save & update UI
function saveAndUpdate(){
  localStorage.setItem("transactions", JSON.stringify(transactions));
  localStorage.setItem("balances", JSON.stringify(balances));
  updateSummary();
  renderTable();
}

// Dashboard totals
function updateDashboardTotals(){
  const now = new Date();
  let daily=0, weekly=0, monthly=0, yearly=0;
  transactions.forEach(tx=>{
    const txDate = new Date(tx.date);
    const amt = (tx.type!=="rebalance") ? tx.amount : 0;
    if(txDate.toDateString() === now.toDateString()) daily+=amt;
    const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay());
    if(txDate>=weekStart) weekly+=amt;
    if(txDate.getMonth()===now.getMonth() && txDate.getFullYear()===now.getFullYear()) monthly+=amt;
    if(txDate.getFullYear()===now.getFullYear()) yearly+=amt;
  });
  dailyEl.textContent = `₱${daily}`;
  weeklyEl.textContent = `₱${weekly}`;
  monthlyEl.textContent = `₱${monthly}`;
  yearlyEl.textContent = `₱${yearly}`;
}

// Initialize
openTab('dashboard');
updateSummary();
renderTable();


// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDF5BuG7cfbLhyIWJkgzKVNmXH9KtB4_AQ",
  authDomain: "cashflowsystem-e8597.firebaseapp.com",
  projectId: "cashflowsystem-e8597",
  storageBucket: "cashflowsystem-e8597.firebasestorage.app",
  messagingSenderId: "282993339590",
  appId: "1:282993339590:web:a9aa3ed3d21341195fbbc7",
  measurementId: "G-8NG4M1874C"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();



                                                  // 1. Initialize Firebase
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "XXX",
  appId: "XXX"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 2. Login Function
function login(email, password) {
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      const uid = user.uid;

      // Fetch role from Firestore
      return db.collection("users").doc(uid).get();
    })
    .then((doc) => {
      if(doc.exists){
        const role = doc.data().name; // "owner" or "cashier"
        window.currentUserRole = role;
        
        // Show appropriate UI
        if(role === "owner") showOwnerUI();
        else showStaffUI();
      } else {
        alert("No role assigned for this user.");
      }
    })
    .catch((error)=>{
      alert(error.message);
    });
}
