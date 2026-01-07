// ----------------- Firebase Config -----------------
const firebaseConfig = {
  apiKey: "AIzaSyDF5BuG7cfbLhyIWJkgzKVNmXH9KtB4_AQ",
  authDomain: "cashflowsystem-e8597.firebaseapp.com",
  projectId: "cashflowsystem-e8597",
  storageBucket: "cashflowsystem-e8597.firebasestorage.app",
  messagingSenderId: "282993339590",
  appId: "1:282993339590:web:a9aa3ed3d21341195fbbc7",
  measurementId: "G-8NG4M1874C"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

// ----------------- Global Variables -----------------
let currentUserRole = "";
const balancesRef = db.collection("balances").doc("main");

// ----------------- LOGIN -----------------
async function login(email, password){
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    const userDoc = await db.collection("users").doc(uid).get();
    if(userDoc.exists){
      currentUserRole = userDoc.data().role;

      document.getElementById("loginSection").style.display = "none";
      document.getElementById("appSection").style.display = "block";

      await applyRoleUI(currentUserRole);
      await loadDashboard();
      await loadTransactions();
    } else {
      alert("No role assigned for this user in Firestore!");
      auth.signOut();
    }

  } catch(error) {
    alert(error.message);
  }
}

// ----------------- ROLE-BASED UI + STARTING BALANCE -----------------
function applyRoleUI(role) {
  const dashboard = document.getElementById("dashboard");
  const rebalance = document.getElementById("rebalance");
  const cashInOut = document.getElementById("cashflow"); // staff tab
  const clearBtn = document.getElementById("clearResetBtn");
  const profitSection = document.getElementById("profitSection"); // profits display

  // SAFETY CHECK
  if (!dashboard) return;

  // DEFAULT: hide sensitive parts
  if (rebalance) rebalance.style.display = "none";
  if (clearBtn) clearBtn.style.display = "none";
  if (profitSection) profitSection.style.display = "none";
  if (cashInOut) cashInOut.style.display = "none";

  // DASHBOARD ALWAYS VISIBLE
  dashboard.style.display = "block";

  if (role === "staff") {
    // STAFF RULES
    if (cashInOut) cashInOut.style.display = "block"; // cash in / out only
    // profit hidden by default
  }

  if (role === "owner") {
    // OWNER RULES
    if (rebalance) rebalance.style.display = "block";
    if (clearBtn) clearBtn.style.display = "block";
    if (profitSection) profitSection.style.display = "block";
  }
}


 
// ----------------- LOGIN FORM -----------------
document.getElementById("loginForm").addEventListener("submit", e=>{
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  login(email, password);
});

// ----------------- TAB SWITCH -----------------
function openTab(tabName, btn){
  document.querySelectorAll(".tabcontent").forEach(t => t.style.display="none");
  document.getElementById(tabName).style.display="block";

  document.querySelectorAll(".tablink").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ----------------- AUTO FEE CALC -----------------
function calculateFee(amount){
  if(amount < 100) return 5;
  if(amount < 500) return 10;
  if(amount < 1000) return 20;
  if(amount < 1500) return 30;
  if(amount < 2000) return 40;
  return 20 + Math.floor((amount-1000)/1000)*20;
}

// ----------------- ADD TRANSACTION -----------------
document.getElementById("transactionForm").addEventListener("submit", async e=>{
  e.preventDefault();

  const type = document.getElementById("type").value.toLowerCase();
  const method = document.getElementById("method").value;
  const notes = document.getElementById("notes").value || "";
  let amount = parseFloat(document.getElementById("amount").value);
  let fee = calculateFee(amount);
  let profit = 0;

  // --- Transaction Logic ---
  if(type === "cashin"){
    profit = fee;
    if(method==="cash") await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(amount-fee), profit: firebase.firestore.FieldValue.increment(fee) });
    else await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(amount-fee), profit: firebase.firestore.FieldValue.increment(fee) });

  } else if(type === "cashout"){
    profit = -amount;
    if(method==="cash") await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-amount) });
    else await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-amount) });

  } else if(type === "loading"){
    const extraCost = 2; // GCash deduction
    profit = amount - (amount + extraCost); // amount customer pays - GCash deducted
    if(method==="gcash") await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-(amount+extraCost)), profit: firebase.firestore.FieldValue.increment(extraCost) });
    else await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-(amount+extraCost)), profit: firebase.firestore.FieldValue.increment(extraCost) });

  } else if(type === "billspayment"){
    const totalDeduction = amount + fee;
    profit = fee;
    if(method==="gcash") await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-totalDeduction), profit: firebase.firestore.FieldValue.increment(fee) });
    else await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-totalDeduction), profit: firebase.firestore.FieldValue.increment(fee) });
  }

  // Save transaction
  await db.collection("transactions").add({
    date: new Date().toISOString(),
    type,
    amount,
    method,
    fee,
    profit,
    notes,
    role: currentUserRole
  });

  document.getElementById("transactionForm").reset();
  await loadDashboard();
  await loadTransactions();
});

// ----------------- REBALANCE -----------------
document.getElementById("rebalanceForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const from = document.getElementById("rebalanceFrom").value;
  const to = document.getElementById("rebalanceTo").value;
  const amount = parseFloat(document.getElementById("rebalanceAmount").value);
  const notes = document.getElementById("rebalanceNotes").value || "";

  if(from===to){ alert("Cannot transfer to same account!"); return; }

  if(from==="cash" && to==="gcash") await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-amount), gcash: firebase.firestore.FieldValue.increment(amount) });
  if(from==="gcash" && to==="cash") await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-amount), cash: firebase.firestore.FieldValue.increment(amount) });

  await db.collection("transactions").add({
    date: new Date().toISOString(),
    type: "rebalance",
    amount,
    method: `${from}→${to}`,
    fee: 0,
    profit: 0,
    notes,
    role: currentUserRole
  });

  document.getElementById("rebalanceForm").reset();
  await loadDashboard();
  await loadTransactions();
});

// ----------------- LOAD DASHBOARD -----------------
async function loadDashboard(){
  const snap = await balancesRef.get();
  if(!snap.exists){
    // Auto-initialize starting balance
    await balancesRef.set({ cash:5320, gcash:736.12, profit:0, initialized:true });
    document.getElementById("dashCash").innerText = "₱5320";
    document.getElementById("dashGcash").innerText = "₱736.12";
    document.getElementById("dashProfit").innerText = "₱0";
    return;
  }

  const data = snap.data();
  document.getElementById("dashCash").innerText = `₱${data.cash || 0}`;
  document.getElementById("dashGcash").innerText = `₱${data.gcash || 0}`;
  document.getElementById("dashProfit").innerText = `₱${data.profit || 0}`;

  // Compute totals
  const txSnap = await db.collection("transactions").get();
  let daily=0, weekly=0, monthly=0, yearly=0;
  const now = new Date();

  txSnap.forEach(doc=>{
    const tx = doc.data();
    if(tx.type==="rebalance") return;

    const txDate = new Date(tx.date);
    if(txDate.toDateString()===now.toDateString()) daily+=tx.profit;
    if(txDate > new Date(now.getFullYear(), now.getMonth(), now.getDate()-7)) weekly+=tx.profit;
    if(txDate.getMonth()===now.getMonth() && txDate.getFullYear()===now.getFullYear()) monthly+=tx.profit;
    if(txDate.getFullYear()===now.getFullYear()) yearly+=tx.profit;
  });

  document.getElementById("dailyTotal").innerText = `₱${daily}`;
  document.getElementById("weeklyTotal").innerText = `₱${weekly}`;
  document.getElementById("monthlyTotal").innerText = `₱${monthly}`;
  document.getElementById("yearlyTotal").innerText = `₱${yearly}`;
}

// ----------------- LOAD TRANSACTIONS -----------------
async function loadTransactions(){
  const txSnap = await db.collection("transactions").get();
  const tbody = document.querySelector("#transactionTable tbody");
  tbody.innerHTML = "";

  txSnap.forEach(doc=>{
    const tx = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(tx.date).toLocaleString()}</td>
      <td>${tx.type}</td>
      <td>₱${tx.amount}</td>
      <td>${tx.method}</td>
      <td>₱${tx.fee}</td>
      <td>₱${tx.profit}</td>
      <td>${tx.notes}</td>
      <td>${tx.role}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ----------------- CLEAR / RESET -----------------
async function clearAllData(){
  if(confirm("Are you sure you want to clear all transactions and reset balances?")){
    const txSnap = await db.collection("transactions").get();
    txSnap.forEach(doc=>doc.ref.delete());
    await balancesRef.set({ cash:5320, gcash:736.12, profit:0, initialized:true });
    await loadDashboard();
    await loadTransactions();
    alert("All data cleared!");
  }
}

// ----------------- SET STARTING BALANCE -----------------
async function setStartingBalance(){
  const cash = Number(document.getElementById("startCash").value);
  const gcash = Number(document.getElementById("startGCash").value);

  if(cash < 0 || gcash < 0){ alert("Invalid amount"); return; }

  await balancesRef.set({
    cash,
    gcash,
    profit:0,
    initialized:true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Starting balance saved!");
  document.getElementById("startingBalanceModal").style.display = "none";
  await loadDashboard();
}

// ----------------- AUTH STATE -----------------
firebase.auth().onAuthStateChanged(async user=>{
  if(!user) return;

  const userDoc = await db.collection("users").doc(user.uid).get();
  if(!userDoc.exists){
    alert("No role assigned for this user in Firestore!");
    firebase.auth().signOut();
    return;
  }

  currentUserRole = userDoc.data().role;
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";

  await applyRoleUI(currentUserRole);
  await loadDashboard();
  await loadTransactions();
});
