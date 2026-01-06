// ----------------- Firebase Setup -----------------


// Firebase config
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// ----------------- Global Variables -----------------
let currentUserRole = "";
const balancesRef = doc(db, "balances", "main");

// ----------------- LOGIN -----------------
async function login(email, password){
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Get role from Firestore
    const userDoc = await getDoc(doc(db, "users", uid));
    if(userDoc.exists()){
      currentUserRole = userDoc.data().name; // "owner" or "cashier"

      if(currentUserRole === "owner") showOwnerUI();
      else showStaffUI();

      loadDashboard();
      loadTransactions();

    } else {
      alert("No role assigned for this user in Firestore!");
    }

  } catch(error) {
    alert(error.message);
  }
}

// Login form listener
document.getElementById("loginForm").addEventListener("submit", e=>{
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  login(email, password);
});

// ----------------- ROLE-BASED UI -----------------
function showOwnerUI(){
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";
  document.getElementById("rebalance").style.display = "block";
  document.getElementById("clearResetBtn").style.display = "block";
}

function showStaffUI(){
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";
  document.getElementById("rebalance").style.display = "none";
  document.getElementById("clearResetBtn").style.display = "none";
}

// ----------------- TAB SWITCH -----------------
function openTab(tabName){
  const tabs = document.querySelectorAll(".tabcontent");
  tabs.forEach(t=>t.style.display="none");
  document.getElementById(tabName).style.display="block";

  const buttons = document.querySelectorAll(".tablink");
  buttons.forEach(b=>b.classList.remove("active"));
  event.currentTarget.classList.add("active");
}

// ----------------- AUTO FEE CALC -----------------
function calculateFee(amount){
  if(amount < 100) return 5;
  if(amount < 500) return 10;
  if(amount < 1000) return 20;
  if(amount < 1500) return 30;
  if(amount < 2000) return 40;
  return 20 + Math.floor((amount-1000)/1000)*20; // per thousand after 1000
}

// ----------------- ADD TRANSACTION -----------------
document.getElementById("transactionForm").addEventListener("submit", async e=>{
  e.preventDefault();

  const type = document.getElementById("type").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const method = document.getElementById("method").value;
  const notes = document.getElementById("notes").value || "";

  const fee = calculateFee(amount);
  const profit = type==="cashin"? amount-fee : -amount;

  // Add transaction
  await addDoc(collection(db, "transactions"), {
    date: new Date().toISOString(),
    type, amount, method, fee, profit, notes,
    role: currentUserRole
  });

  // Update balances
  if(type==="cashin"){
    if(method==="cash") await updateDoc(balancesRef, { cash: increment(amount-fee), profit: increment(fee) });
    else await updateDoc(balancesRef, { gcash: increment(amount-fee), profit: increment(fee) });
  } else {
    if(method==="cash") await updateDoc(balancesRef, { cash: increment(-amount) });
    else await updateDoc(balancesRef, { gcash: increment(-amount) });
  }

  document.getElementById("transactionForm").reset();
  loadDashboard();
  loadTransactions();
});

// ----------------- REBALANCE -----------------
document.getElementById("rebalanceForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const from = document.getElementById("rebalanceFrom").value;
  const to = document.getElementById("rebalanceTo").value;
  const amount = parseFloat(document.getElementById("rebalanceAmount").value);
  const notes = document.getElementById("rebalanceNotes").value || "";

  if(from===to){ alert("Cannot transfer to same account!"); return; }

  // Update balances
  if(from==="cash" && to==="gcash"){
    await updateDoc(balancesRef, { cash: increment(-amount), gcash: increment(amount) });
  } else if(from==="gcash" && to==="cash"){
    await updateDoc(balancesRef, { gcash: increment(-amount), cash: increment(amount) });
  }

  // Add rebalance transaction
  await addDoc(collection(db, "transactions"), {
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
  loadDashboard();
  loadTransactions();
});

// ----------------- LOAD DASHBOARD -----------------
async function loadDashboard(){
  const snap = await getDoc(balancesRef);
  if(snap.exists()){
    const data = snap.data();
    document.getElementById("dashCash").innerText = `₱${data.cash || 0}`;
    document.getElementById("dashGcash").innerText = `₱${data.gcash || 0}`;
    document.getElementById("dashProfit").innerText = `₱${data.profit || 0}`;
  }

  // Compute totals
  const txSnap = await getDocs(collection(db, "transactions"));
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
  const txSnap = await getDocs(collection(db, "transactions"));
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
    const txSnap = await getDocs(collection(db, "transactions"));
    txSnap.forEach(doc=>doc.ref.delete());
    await updateDoc(balancesRef, { cash:0, gcash:0, profit:0 });
    loadDashboard();
    loadTransactions();
    alert("All data cleared!");
  }
}
