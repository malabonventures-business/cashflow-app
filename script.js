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
async function login(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const uid = userCredential.user.uid;

    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      currentUserRole = userDoc.data().role;

      document.getElementById("loginSection").style.display = "none";
      document.getElementById("appSection").style.display = "block";

      await applyRoleUI(currentUserRole);

      // Setup real-time updates
      setupDashboardRealtime();
      setupTransactionsListener();

    } else {
      alert("No role assigned for this user in Firestore!");
      auth.signOut();
    }
  } catch (error) {
    alert(error.message);
  }
}

// ----------------- ROLE-BASED UI -----------------
async function applyRoleUI(role) {
  const dashboard = document.getElementById("dashboard");
  const rebalance = document.getElementById("rebalance");
  const cashInOut = document.getElementById("cashflow");
  const clearBtn = document.getElementById("clearResetBtn");
  const ownerTab = document.getElementById("ownerSettingsTab");
  const profitSection = document.getElementById("profitSection");

  dashboard.style.display = "block";
  if (rebalance) rebalance.style.display = "none";
  if (profitSection) profitSection.style.display = "none";
  if (cashInOut) cashInOut.style.display = "none";
  if (clearBtn) clearBtn.style.display = "none";
  if (ownerTab) ownerTab.style.display = "none";

  if (role === "staff") {
    if (cashInOut) cashInOut.style.display = "block";
  }

  if (role === "owner") {
    if (cashInOut) cashInOut.style.display = "block";
    if (rebalance) rebalance.style.display = "block";
    if (profitSection) profitSection.style.display = "block";
    if (clearBtn) clearBtn.style.display = "inline-block";
    if (ownerTab) ownerTab.style.display = "inline-block";
  }
}

// ----------------- LOGIN FORM -----------------
document.getElementById("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  login(email, password);
});

// ----------------- TAB SWITCH -----------------
function openTab(tabName, btn) {
  document.querySelectorAll(".tabcontent").forEach(t => t.style.display = "none");
  document.getElementById(tabName).style.display = "block";

  document.querySelectorAll(".tablink").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ----------------- AUTO FEE CALC -----------------
function calculateFee(amount) {
  if (amount < 100) return 5;
  if (amount < 500) return 10;
  if (amount < 1000) return 20;
  if (amount < 1500) return 30;
  if (amount < 2000) return 40;
  return 20 + Math.floor((amount - 1000) / 1000) * 20;
}

// ----------------- ADD TRANSACTION -----------------
document.getElementById("transactionForm").addEventListener("submit", async e => {
  e.preventDefault();

  const type = document.getElementById("type").value.toLowerCase();
  const method = document.getElementById("method").value;
  const notes = document.getElementById("notes").value || "";
  const amount = parseFloat(document.getElementById("amount").value);
  const fee = calculateFee(amount);
  let profit = 0;

  // Update balances
  if (type === "cashin") {
    profit = fee;
    if (method === "cash") await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(amount - fee), profit: firebase.firestore.FieldValue.increment(fee) });
    else await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(amount - fee), profit: firebase.firestore.FieldValue.increment(fee) });

  } else if (type === "cashout") {
    profit = 0;
    if (method === "cash") await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-amount) });
    else await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-amount) });

  } else if (type === "loading") {
    profit = 2;
    if (method === "gcash") await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-(amount + 2)), profit: firebase.firestore.FieldValue.increment(2) });
    else await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-(amount + 2)), profit: firebase.firestore.FieldValue.increment(2) });

  } else if (type === "billspayment") {
    profit = fee;
    if (method === "gcash") await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-(amount + fee)), profit: firebase.firestore.FieldValue.increment(fee) });
    else await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-(amount + fee)), profit: firebase.firestore.FieldValue.increment(fee) });
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
});

// ----------------- REBALANCE -----------------
document.getElementById("rebalanceForm").addEventListener("submit", async e => {
  e.preventDefault();

  const from = document.getElementById("rebalanceFrom").value;
  const to = document.getElementById("rebalanceTo").value;
  const amount = parseFloat(document.getElementById("rebalanceAmount").value);
  const notes = document.getElementById("rebalanceNotes").value || "";

  if (from === to) { alert("Cannot transfer to same account!"); return; }

  if (from === "cash" && to === "gcash") await balancesRef.update({ cash: firebase.firestore.FieldValue.increment(-amount), gcash: firebase.firestore.FieldValue.increment(amount) });
  if (from === "gcash" && to === "cash") await balancesRef.update({ gcash: firebase.firestore.FieldValue.increment(-amount), cash: firebase.firestore.FieldValue.increment(amount) });

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
});

// ----------------- REAL-TIME DASHBOARD -----------------
function setupDashboardRealtime() {
  // Balances
  balancesRef.onSnapshot((snap) => {
    if (!snap.exists) return;
    const data = snap.data();
    document.getElementById("dashCash").innerText = `₱${data.cash || 0}`;
    document.getElementById("dashGcash").innerText = `₱${data.gcash || 0}`;
    document.getElementById("dashProfit").innerText = `₱${data.profit || 0}`;
  });

  // Totals
  db.collection("transactions").onSnapshot((snap) => {
    let daily = 0, weekly = 0, monthly = 0, yearly = 0;
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    snap.forEach(doc => {
      const tx = doc.data();
      if (tx.type === "rebalance") return;
      const txDate = new Date(tx.date);
      if (txDate.toDateString() === now.toDateString()) daily += tx.profit;
      if (txDate >= sevenDaysAgo) weekly += tx.profit;
      if (txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()) monthly += tx.profit;
      if (txDate.getFullYear() === now.getFullYear()) yearly += tx.profit;
    });

    document.getElementById("dailyTotal").innerText = `₱${daily}`;
    document.getElementById("weeklyTotal").innerText = `₱${weekly}`;
    document.getElementById("monthlyTotal").innerText = `₱${monthly}`;
    document.getElementById("yearlyTotal").innerText = `₱${yearly}`;
  });
}

// ----------------- TRANSACTION TABLE -----------------
function setupTransactionsListener() {
  db.collection("transactions").orderBy("date", "desc").onSnapshot((snapshot) => {
    const tbody = document.querySelector("#transactionTable tbody");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
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
  });
}

// ----------------- CLEAR / RESET -----------------
async function clearAllData() {
  if (!confirm("Are you sure you want to clear all transactions and reset balances?")) return;

  const txSnap = await db.collection("transactions").get();
  const deletePromises = [];
  txSnap.forEach(doc => deletePromises.push(doc.ref.delete()));
  await Promise.all(deletePromises);

  const manualCash = Number(document.getElementById("manualCash").value);
  const manualGCash = Number(document.getElementById("manualGCash").value);
  await balancesRef.set({ cash: manualCash, gcash: manualGCash, profit:0, initialized:true });

  alert("All data cleared!");
}

// ----------------- AUTH STATE -----------------
auth.onAuthStateChanged(async user => {
  if (!user) return;

  const userDoc = await db.collection("users").doc(user.uid).get();
  if (!userDoc.exists) {
    alert("No role assigned for this user in Firestore!");
    auth.signOut();
    return;
  }

  currentUserRole = userDoc.data().role;
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";

  await applyRoleUI(currentUserRole);

  setupDashboardRealtime();
  setupTransactionsListener();
});

// ----------------- LOGOUT -----------------
function logout() {
  auth.signOut().then(() => {
    document.getElementById("appSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPassword").value = "";
  }).catch(error => alert("Logout failed: " + error.message));
}
