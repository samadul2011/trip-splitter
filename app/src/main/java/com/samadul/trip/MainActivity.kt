package com.samadul.trip

import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private val executor = Executors.newCachedThreadPool()
    private lateinit var rootContainer: FrameLayout

    private var baseUrl: String = "https://trip-splitter-mauve.vercel.app"
    private var accessToken: String? = null
    private var currentUser: UserProfile? = null

    private var selectedTrip: TripItem? = null
    private var activeTripTab: String = "expenses" // "expenses" or "report"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("trip_splitter_prefs", Context.MODE_PRIVATE)
        val savedUrl = prefs.getString("base_url", "https://trip-splitter-mauve.vercel.app")
        baseUrl = if (savedUrl.isNullOrBlank() || savedUrl == "http://10.0.2.2:3000") {
            "https://trip-splitter-mauve.vercel.app"
        } else {
            savedUrl
        }
        accessToken = prefs.getString("access_token", null)
        val savedUserId = prefs.getString("user_id", null)
        val savedUserName = prefs.getString("user_name", null)
        val savedIsAdmin = prefs.getBoolean("is_admin", false)

        if (!accessToken.isNullOrBlank() && !savedUserId.isNullOrBlank() && !savedUserName.isNullOrBlank()) {
            currentUser = UserProfile(savedUserId, savedUserName, savedIsAdmin)
        }

        rootContainer = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#F8FAFC"))
        }
        setContentView(rootContainer)

        if (currentUser != null && !accessToken.isNullOrBlank()) {
            showDashboardScreen()
        } else {
            showLoginScreen()
        }
    }

    private fun saveSession(url: String, token: String?, user: UserProfile?) {
        baseUrl = url.trim().trimEnd('/')
        accessToken = token
        currentUser = user
        val prefs = getSharedPreferences("trip_splitter_prefs", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("base_url", baseUrl)
            if (token != null && user != null) {
                putString("access_token", token)
                putString("user_id", user.id)
                putString("user_name", user.fullName)
                putBoolean("is_admin", user.isAdmin)
            } else {
                remove("access_token")
                remove("user_id")
                remove("user_name")
                remove("is_admin")
            }
            apply()
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun cardBg(
        fillColor: String = "#FFFFFF",
        strokeColor: String = "#E2E8F0",
        cornerRadiusDp: Int = 16
    ): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(cornerRadiusDp).toFloat()
            setColor(Color.parseColor(fillColor))
            setStroke(dp(1), Color.parseColor(strokeColor))
        }
    }

    private fun formatTaka(amount: Double): String {
        return if (amount % 1.0 == 0.0) {
            "৳${String.format(Locale.US, "%,.0f", amount)}"
        } else {
            "৳${String.format(Locale.US, "%,.2f", amount)}"
        }
    }

    // =========================================================================
    // SCREEN 1: LOGIN
    // =========================================================================
    private fun showLoginScreen() {
        rootContainer.removeAllViews()

        val scroll = ScrollView(this).apply {
            isFillViewport = true
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(48), dp(24), dp(32))
        }

        val logoView = ImageView(this).apply {
            setImageResource(R.drawable.ic_tripsplit_logo)
            layoutParams = LinearLayout.LayoutParams(dp(72), dp(72)).apply {
                bottomMargin = dp(12)
            }
            background = cardBg("#059669", "#A7F3D0", 20)
            clipToOutline = true
        }

        val title = TextView(this).apply {
            text = "TripSplit"
            textSize = 28f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#047857"))
            gravity = Gravity.CENTER
        }
        val subtitle = TextView(this).apply {
            text = "Group Trip Expense & Settlement"
            textSize = 14f
            setTextColor(Color.parseColor("#64748B"))
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(24))
        }

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg("#FFFFFF", "#A7F3D0", 20)
            setPadding(dp(20), dp(24), dp(20), dp(24))
        }

        val serverLabel = TextView(this).apply {
            text = "Server URL (Vercel URL or Local IP)"
            textSize = 12f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#334155"))
        }
        val serverInput = EditText(this).apply {
            setText(baseUrl)
            hint = "https://trip-splitter-mauve.vercel.app"
            textSize = 14f
            setSingleLine(true)
            background = cardBg("#F8FAFC", "#CBD5E1", 10)
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }

        val nameLabel = TextView(this).apply {
            text = "Your Name (User ID)"
            textSize = 13f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#334155"))
            setPadding(0, dp(14), 0, dp(4))
        }
        val nameInput = EditText(this).apply {
            hint = "e.g., Samadul, Sabuj, Limon, Arian..."
            textSize = 15f
            setSingleLine(true)
            background = cardBg("#F8FAFC", "#CBD5E1", 10)
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }

        val passLabel = TextView(this).apply {
            text = "Password"
            textSize = 13f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#334155"))
            setPadding(0, dp(14), 0, dp(4))
        }
        val passInput = EditText(this).apply {
            hint = "Enter your password"
            textSize = 15f
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            background = cardBg("#F8FAFC", "#CBD5E1", 10)
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }

        val errorView = TextView(this).apply {
            textSize = 13f
            setTextColor(Color.parseColor("#DC2626"))
            visibility = View.GONE
            setPadding(0, dp(10), 0, 0)
        }

        val loginBtn = Button(this).apply {
            text = "Login"
            isAllCaps = false
            textSize = 15f
            setTextColor(Color.WHITE)
            background = cardBg("#059669", "#059669", 12)
        }

        val btnParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(48)
        ).apply { topMargin = dp(20) }

        loginBtn.setOnClickListener {
            val server = serverInput.text.toString().trim()
            val name = nameInput.text.toString().trim()
            val pass = passInput.text.toString().trim()

            if (server.isEmpty() || name.isEmpty() || pass.isEmpty()) {
                errorView.text = "Please fill in Server URL, Your Name, and Password."
                errorView.visibility = View.VISIBLE
                return@setOnClickListener
            }

            errorView.visibility = View.GONE
            loginBtn.isEnabled = false
            loginBtn.text = "Signing in..."

            executor.execute {
                try {
                    val (token, profile) = ApiClient.login(server, name, pass)
                    runOnUiThread {
                        saveSession(server, token, profile)
                        Toast.makeText(
                            this,
                            "Welcome, ${profile.fullName}!",
                            Toast.LENGTH_SHORT
                        ).show()
                        showDashboardScreen()
                    }
                } catch (e: Exception) {
                    runOnUiThread {
                        loginBtn.isEnabled = true
                        loginBtn.text = "Login"
                        errorView.text = e.message ?: "Login failed"
                        errorView.visibility = View.VISIBLE
                    }
                }
            }
        }

        val infoNote = TextView(this).apply {
            text = "Registered Members: Samadul (Admin), Sabuj, Limon, Arian, Tanha, Sabina, Luto"
            textSize = 12f
            setTextColor(Color.parseColor("#065F46"))
            setPadding(0, dp(16), 0, 0)
        }

        card.addView(serverLabel)
        card.addView(serverInput)
        card.addView(nameLabel)
        card.addView(nameInput)
        card.addView(passLabel)
        card.addView(passInput)
        card.addView(errorView)
        card.addView(loginBtn, btnParams)
        card.addView(infoNote)

        layout.addView(logoView)
        layout.addView(title)
        layout.addView(subtitle)
        layout.addView(card)
        scroll.addView(layout)
        rootContainer.addView(scroll)
    }

    // =========================================================================
    // SCREEN 2: DASHBOARD
    // =========================================================================
    private fun showDashboardScreen() {
        val user = currentUser ?: return showLoginScreen()
        val token = accessToken ?: return showLoginScreen()
        val isAdmin = user.isAdmin || user.fullName.equals("Samadul", ignoreCase = true)

        rootContainer.removeAllViews()
        val scroll = ScrollView(this).apply { isFillViewport = true }
        val mainLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(36), dp(16), dp(32))
        }

        // Top Bar
        val topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, dp(16))
        }

        val headerLogo = ImageView(this).apply {
            setImageResource(R.drawable.ic_tripsplit_logo)
            layoutParams = LinearLayout.LayoutParams(dp(42), dp(42)).apply {
                rightMargin = dp(12)
            }
            background = cardBg("#059669", "#A7F3D0", 12)
            clipToOutline = true
        }

        val titleCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val welcomeText = TextView(this).apply {
            text = if (isAdmin) "Welcome, ${user.fullName}! (ADMIN)" else "Welcome, ${user.fullName}!"
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
        }
        val roleSub = TextView(this).apply {
            text = if (isAdmin) {
                "Admin: You can create/close trips & edit/delete wrong expenses"
            } else {
                "Tap a trip to add expenses or view the shared report"
            }
            textSize = 12f
            setTextColor(Color.parseColor("#475569"))
        }
        titleCol.addView(welcomeText)
        titleCol.addView(roleSub)

        val logoutBtn = Button(this).apply {
            text = "Logout"
            isAllCaps = false
            textSize = 12f
            setTextColor(Color.parseColor("#DC2626"))
            background = cardBg("#FEF2F2", "#FECACA", 10)
            setOnClickListener {
                saveSession(baseUrl, null, null)
                showLoginScreen()
            }
        }

        topBar.addView(headerLogo)
        topBar.addView(titleCol)
        topBar.addView(logoutBtn)
        mainLayout.addView(topBar)

        // Admin Create New Trip Button
        if (isAdmin) {
            val createTripBtn = Button(this).apply {
                text = "+ Create New Trip (Admin)"
                isAllCaps = false
                textSize = 14f
                setTextColor(Color.WHITE)
                background = cardBg("#059669", "#059669", 12)
                setOnClickListener {
                    showCreateTripDialog()
                }
            }
            val createParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(46)
            ).apply { bottomMargin = dp(16) }
            mainLayout.addView(createTripBtn, createParams)
        }

        val listContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val loadingText = TextView(this).apply {
            text = "Loading trips..."
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, dp(32), 0, dp(32))
        }
        listContainer.addView(loadingText)
        mainLayout.addView(listContainer)

        scroll.addView(mainLayout)
        rootContainer.addView(scroll)

        executor.execute {
            try {
                val trips = ApiClient.getTrips(baseUrl, token)
                runOnUiThread {
                    listContainer.removeAllViews()
                    if (trips.isEmpty()) {
                        val emptyView = TextView(this).apply {
                            text = if (isAdmin) {
                                "No trips yet. Tap '+ Create New Trip' above to start!"
                            } else {
                                "No trips yet. Wait for Admin (Samadul) to create a trip."
                            }
                            textSize = 14f
                            setTextColor(Color.parseColor("#64748B"))
                            gravity = Gravity.CENTER
                            setPadding(dp(16), dp(36), dp(16), dp(36))
                        }
                        listContainer.addView(emptyView)
                    } else {
                        trips.forEach { trip ->
                            val itemCard = LinearLayout(this).apply {
                                orientation = LinearLayout.VERTICAL
                                background = cardBg("#FFFFFF", "#CBD5E1", 14)
                                setPadding(dp(16), dp(14), dp(16), dp(14))
                                isClickable = true
                                isFocusable = true
                                setOnClickListener {
                                    selectedTrip = trip
                                    activeTripTab = "expenses"
                                    showTripDetailScreen(trip.id)
                                }
                            }
                            val itemParams = LinearLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.WRAP_CONTENT
                            ).apply { bottomMargin = dp(12) }

                            val row1 = LinearLayout(this).apply {
                                orientation = LinearLayout.HORIZONTAL
                                gravity = Gravity.CENTER_VERTICAL
                            }
                            val tripTitle = TextView(this).apply {
                                text = trip.name
                                textSize = 17f
                                setTypeface(typeface, Typeface.BOLD)
                                setTextColor(Color.parseColor("#0F172A"))
                                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                            }
                            val badge = TextView(this).apply {
                                text = if (trip.isCompleted) "CLOSED" else "ACTIVE"
                                textSize = 11f
                                setTypeface(typeface, Typeface.BOLD)
                                setTextColor(
                                    Color.parseColor(if (trip.isCompleted) "#065F46" else "#0369A1")
                                )
                                background = cardBg(
                                    if (trip.isCompleted) "#D1FAE5" else "#E0F2FE",
                                    if (trip.isCompleted) "#A7F3D0" else "#BAE6FD",
                                    8
                                )
                                setPadding(dp(8), dp(4), dp(8), dp(4))
                            }
                            row1.addView(tripTitle)
                            row1.addView(badge)

                            val row2 = TextView(this).apply {
                                text = "${trip.memberCount} members  •  Total Spent: ${formatTaka(trip.totalSpent)}"
                                textSize = 13f
                                setTextColor(Color.parseColor("#047857"))
                                setPadding(0, dp(8), 0, 0)
                            }

                            itemCard.addView(row1)
                            itemCard.addView(row2)
                            listContainer.addView(itemCard, itemParams)
                        }
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    listContainer.removeAllViews()
                    val errView = TextView(this).apply {
                        text = "Error loading trips: ${e.message}"
                        setTextColor(Color.parseColor("#DC2626"))
                    }
                    listContainer.addView(errView)
                }
            }
        }
    }

    private fun showCreateTripDialog() {
        val token = accessToken ?: return
        val currentId = currentUser?.id ?: return

        executor.execute {
            try {
                val allUsers = ApiClient.getUsers(baseUrl, token)
                val otherUsers = allUsers.filter { it.id != currentId }

                runOnUiThread {
                    val container = LinearLayout(this).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(dp(20), dp(16), dp(20), dp(8))
                    }
                    val nameInput = EditText(this).apply {
                        hint = "Trip Name (e.g., Sylhet 2026)"
                        setSingleLine(true)
                    }
                    container.addView(nameInput)

                    val membersTitle = TextView(this).apply {
                        text = "Select Trip Members (You are included automatically):"
                        textSize = 13f
                        setTypeface(typeface, Typeface.BOLD)
                        setPadding(0, dp(12), 0, dp(6))
                    }
                    container.addView(membersTitle)

                    val checkBoxes = mutableListOf<Pair<String, CheckBox>>()
                    otherUsers.forEach { u ->
                        val cb = CheckBox(this).apply {
                            text = u.fullName
                            isChecked = true
                        }
                        checkBoxes.add(u.id to cb)
                        container.addView(cb)
                    }

                    AlertDialog.Builder(this)
                        .setTitle("Create New Trip (Admin)")
                        .setView(container)
                        .setPositiveButton("Create Trip") { _, _ ->
                            val tripName = nameInput.text.toString().trim()
                            if (tripName.isEmpty()) {
                                Toast.makeText(this, "Please enter a trip name", Toast.LENGTH_SHORT).show()
                                return@setPositiveButton
                            }
                            val selectedIds = checkBoxes.filter { it.second.isChecked }.map { it.first }
                            executor.execute {
                                try {
                                    val created = ApiClient.createTrip(baseUrl, token, tripName, selectedIds)
                                    runOnUiThread {
                                        Toast.makeText(this, "Trip created!", Toast.LENGTH_SHORT).show()
                                        showTripDetailScreen(created.id)
                                    }
                                } catch (e: Exception) {
                                    runOnUiThread {
                                        Toast.makeText(this, e.message ?: "Failed", Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this, "Failed to load users: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // =========================================================================
    // SCREEN 3: TRIP DETAIL (EXPENSES TAB & REPORT/SETTLEMENT TAB)
    // =========================================================================
    private fun showTripDetailScreen(tripId: String) {
        val user = currentUser ?: return showLoginScreen()
        val token = accessToken ?: return showLoginScreen()
        val isAdmin = user.isAdmin || user.fullName.equals("Samadul", ignoreCase = true)

        rootContainer.removeAllViews()
        val scroll = ScrollView(this).apply { isFillViewport = true }
        val mainLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(36), dp(16), dp(32))
        }

        val backBtn = Button(this).apply {
            text = "← Back to Trips"
            isAllCaps = false
            textSize = 13f
            setTextColor(Color.parseColor("#334155"))
            background = cardBg("#FFFFFF", "#CBD5E1", 10)
            setOnClickListener { showDashboardScreen() }
        }
        mainLayout.addView(
            backBtn,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(38)).apply {
                bottomMargin = dp(12)
            }
        )

        val contentBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        val loadingView = TextView(this).apply {
            text = "Loading trip expenses & settlement report..."
            gravity = Gravity.CENTER
            setPadding(0, dp(40), 0, dp(40))
        }
        contentBox.addView(loadingView)
        mainLayout.addView(contentBox)
        scroll.addView(mainLayout)
        rootContainer.addView(scroll)

        executor.execute {
            try {
                val trip = ApiClient.getTripDetail(baseUrl, token, tripId)
                val expenses = ApiClient.getExpenses(baseUrl, token, tripId)
                val report = ApiClient.getReport(baseUrl, token, tripId)

                runOnUiThread {
                    contentBox.removeAllViews()

                    // Header Card
                    val headerCard = LinearLayout(this).apply {
                        orientation = LinearLayout.VERTICAL
                        background = cardBg("#FFFFFF", "#A7F3D0", 16)
                        setPadding(dp(16), dp(16), dp(16), dp(16))
                    }
                    val titleView = TextView(this).apply {
                        text = "${trip.name} (${if (trip.isCompleted) "Closed" else "Active"})"
                        textSize = 20f
                        setTypeface(typeface, Typeface.BOLD)
                        setTextColor(Color.parseColor("#0F172A"))
                    }
                    val membersView = TextView(this).apply {
                        text = "Members: " + trip.members.joinToString(", ") { it.fullName }
                        textSize = 12f
                        setTextColor(Color.parseColor("#475569"))
                        setPadding(0, dp(4), 0, dp(10))
                    }
                    headerCard.addView(titleView)
                    headerCard.addView(membersView)

                    // Admin Close / Reopen Trip button
                    if (isAdmin) {
                        val statusBtn = Button(this).apply {
                            text = if (trip.isCompleted) "Reopen Trip (Admin)" else "Close / Complete Trip (Admin)"
                            isAllCaps = false
                            textSize = 13f
                            setTextColor(Color.WHITE)
                            background = cardBg(
                                if (trip.isCompleted) "#0284C7" else "#059669",
                                if (trip.isCompleted) "#0284C7" else "#059669",
                                10
                            )
                            setOnClickListener {
                                executor.execute {
                                    try {
                                        ApiClient.updateTripStatus(baseUrl, token, tripId, !trip.isCompleted)
                                        runOnUiThread {
                                            activeTripTab = if (!trip.isCompleted) "report" else "expenses"
                                            showTripDetailScreen(tripId)
                                        }
                                    } catch (e: Exception) {
                                        runOnUiThread {
                                            Toast.makeText(this@MainActivity, e.message, Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            }
                        }
                        headerCard.addView(statusBtn)
                    }

                    // Tabs Row
                    val tabsRow = LinearLayout(this).apply {
                        orientation = LinearLayout.HORIZONTAL
                        setPadding(0, dp(12), 0, 0)
                    }
                    val tabExpBtn = Button(this).apply {
                        text = "Add & View Expenses"
                        isAllCaps = false
                        textSize = 13f
                        setTextColor(if (activeTripTab == "expenses") Color.WHITE else Color.parseColor("#334155"))
                        background = cardBg(
                            if (activeTripTab == "expenses") "#059669" else "#F1F5F9",
                            "#CBD5E1",
                            10
                        )
                        layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f).apply { rightMargin = dp(6) }
                        setOnClickListener {
                            activeTripTab = "expenses"
                            showTripDetailScreen(tripId)
                        }
                    }
                    val tabRepBtn = Button(this).apply {
                        text = "Report & Settlement"
                        isAllCaps = false
                        textSize = 13f
                        setTextColor(if (activeTripTab == "report") Color.WHITE else Color.parseColor("#0369A1"))
                        background = cardBg(
                            if (activeTripTab == "report") "#0284C7" else "#E0F2FE",
                            "#BAE6FD",
                            10
                        )
                        layoutParams = LinearLayout.LayoutParams(0, dp(42), 1f).apply { leftMargin = dp(6) }
                        setOnClickListener {
                            activeTripTab = "report"
                            showTripDetailScreen(tripId)
                        }
                    }
                    tabsRow.addView(tabExpBtn)
                    tabsRow.addView(tabRepBtn)
                    headerCard.addView(tabsRow)

                    contentBox.addView(
                        headerCard,
                        LinearLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.WRAP_CONTENT
                        ).apply { bottomMargin = dp(16) }
                    )

                    if (activeTripTab == "expenses") {
                        renderExpensesTab(contentBox, trip, expenses, isAdmin)
                    } else {
                        renderReportTab(contentBox, trip, report, isAdmin)
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    contentBox.removeAllViews()
                    val err = TextView(this).apply {
                        text = "Error: ${e.message}"
                        setTextColor(Color.parseColor("#DC2626"))
                    }
                    contentBox.addView(err)
                }
            }
        }
    }

    private fun renderExpensesTab(
        parent: LinearLayout,
        trip: TripItem,
        expenses: List<ExpenseItem>,
        isAdmin: Boolean
    ) {
        val token = accessToken ?: return
        val user = currentUser ?: return

        if (!trip.isCompleted || isAdmin) {
            val formCard = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                background = cardBg("#FFFFFF", "#E2E8F0", 16)
                setPadding(dp(16), dp(16), dp(16), dp(16))
            }

            val formTitle = TextView(this).apply {
                text = "Log a New Expense"
                textSize = 16f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(Color.parseColor("#0F172A"))
            }
            formCard.addView(formTitle)

            var memberSpinner: Spinner? = null
            if (isAdmin && trip.members.isNotEmpty()) {
                val whoLabel = TextView(this).apply {
                    text = "Who Spent? (Admin)"
                    textSize = 12f
                    setPadding(0, dp(8), 0, dp(4))
                }
                memberSpinner = Spinner(this).apply {
                    adapter = ArrayAdapter(
                        this@MainActivity,
                        android.R.layout.simple_spinner_dropdown_item,
                        trip.members.map { it.fullName }
                    )
                    val idx = trip.members.indexOfFirst { it.id == user.id }
                    if (idx >= 0) setSelection(idx)
                }
                formCard.addView(whoLabel)
                formCard.addView(memberSpinner)
            }

            val amountInput = EditText(this).apply {
                hint = "Amount in Taka (e.g., 500)"
                inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            }
            val descInput = EditText(this).apply {
                hint = "What did you spend on? (e.g., Lunch at hotel)"
                setSingleLine(true)
            }
            val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            val dateInput = EditText(this).apply {
                setText(today)
                hint = "YYYY-MM-DD"
                setSingleLine(true)
            }

            val addBtn = Button(this).apply {
                text = "+ Add Expense"
                isAllCaps = false
                setTextColor(Color.WHITE)
                background = cardBg("#059669", "#059669", 10)
                setOnClickListener {
                    val amt = amountInput.text.toString().toDoubleOrNull()
                    val desc = descInput.text.toString().trim()
                    val dt = dateInput.text.toString().trim()

                    if (amt == null || amt <= 0 || desc.isEmpty()) {
                        Toast.makeText(this@MainActivity, "Enter valid amount and description", Toast.LENGTH_SHORT).show()
                        return@setOnClickListener
                    }

                    val selectedPayerId = if (isAdmin && memberSpinner != null && trip.members.isNotEmpty()) {
                        trip.members[memberSpinner.selectedItemPosition].id
                    } else {
                        user.id
                    }

                    executor.execute {
                        try {
                            ApiClient.addExpense(baseUrl, token, trip.id, amt, desc, dt, selectedPayerId)
                            runOnUiThread {
                                Toast.makeText(this@MainActivity, "Expense added!", Toast.LENGTH_SHORT).show()
                                showTripDetailScreen(trip.id)
                            }
                        } catch (e: Exception) {
                            runOnUiThread {
                                Toast.makeText(this@MainActivity, e.message, Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                }
            }

            formCard.addView(amountInput)
            formCard.addView(descInput)
            formCard.addView(dateInput)
            formCard.addView(
                addBtn,
                LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(44)).apply {
                    topMargin = dp(10)
                }
            )

            parent.addView(
                formCard,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dp(16) }
            )
        }

        // Expenses List Card
        val listCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg("#FFFFFF", "#E2E8F0", 16)
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }
        val listHeader = TextView(this).apply {
            text = "All Trip Expenses (${expenses.size})"
            textSize = 16f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
            setPadding(0, 0, 0, dp(8))
        }
        listCard.addView(listHeader)

        if (expenses.isEmpty()) {
            val empty = TextView(this).apply {
                text = "No expenses logged yet."
                setTextColor(Color.parseColor("#64748B"))
            }
            listCard.addView(empty)
        } else {
            expenses.forEach { exp ->
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    background = cardBg("#F8FAFC", "#E2E8F0", 10)
                    setPadding(dp(12), dp(10), dp(12), dp(10))
                }
                val rowParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dp(8) }

                val topLine = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                }
                val whoView = TextView(this).apply {
                    text = "${exp.userName}  •  ${exp.date}"
                    textSize = 13f
                    setTypeface(typeface, Typeface.BOLD)
                    setTextColor(Color.parseColor("#0F172A"))
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                }
                val amtView = TextView(this).apply {
                    text = formatTaka(exp.amount)
                    textSize = 14f
                    setTypeface(typeface, Typeface.BOLD)
                    setTextColor(Color.parseColor("#047857"))
                }
                topLine.addView(whoView)
                topLine.addView(amtView)

                val descView = TextView(this).apply {
                    text = exp.description
                    textSize = 13f
                    setTextColor(Color.parseColor("#475569"))
                    setPadding(0, dp(4), 0, 0)
                }

                row.addView(topLine)
                row.addView(descView)

                // Admin Edit & Delete Buttons
                if (isAdmin) {
                    val actionsRow = LinearLayout(this).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = Gravity.END
                        setPadding(0, dp(6), 0, 0)
                    }
                    val editBtn = Button(this).apply {
                        text = "Edit"
                        isAllCaps = false
                        textSize = 11f
                        setOnClickListener {
                            showEditExpenseDialog(trip, exp)
                        }
                    }
                    val delBtn = Button(this).apply {
                        text = "Delete"
                        isAllCaps = false
                        textSize = 11f
                        setTextColor(Color.parseColor("#DC2626"))
                        setOnClickListener {
                            AlertDialog.Builder(this@MainActivity)
                                .setTitle("Delete Wrong Expense?")
                                .setMessage("Delete '${exp.description}' (${formatTaka(exp.amount)}) by ${exp.userName}?")
                                .setPositiveButton("Delete") { _, _ ->
                                    executor.execute {
                                        try {
                                            ApiClient.deleteExpense(baseUrl, token, trip.id, exp.id)
                                            runOnUiThread {
                                                Toast.makeText(this@MainActivity, "Expense deleted", Toast.LENGTH_SHORT).show()
                                                showTripDetailScreen(trip.id)
                                            }
                                        } catch (e: Exception) {
                                            runOnUiThread {
                                                Toast.makeText(this@MainActivity, e.message, Toast.LENGTH_LONG).show()
                                            }
                                        }
                                    }
                                }
                                .setNegativeButton("Cancel", null)
                                .show()
                        }
                    }
                    actionsRow.addView(editBtn)
                    actionsRow.addView(delBtn)
                    row.addView(actionsRow)
                }

                listCard.addView(row, rowParams)
            }
        }

        parent.addView(listCard)
    }

    private fun showEditExpenseDialog(trip: TripItem, exp: ExpenseItem) {
        val token = accessToken ?: return
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(8))
        }

        val memberSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(
                this@MainActivity,
                android.R.layout.simple_spinner_dropdown_item,
                trip.members.map { it.fullName }
            )
            val idx = trip.members.indexOfFirst { it.id == exp.paidBy || it.fullName == exp.userName }
            if (idx >= 0) setSelection(idx)
        }
        val amtInput = EditText(this).apply {
            setText(exp.amount.toString())
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
        }
        val descInput = EditText(this).apply {
            setText(exp.description)
        }
        val dateInput = EditText(this).apply {
            setText(exp.date)
        }

        box.addView(memberSpinner)
        box.addView(amtInput)
        box.addView(descInput)
        box.addView(dateInput)

        AlertDialog.Builder(this)
            .setTitle("Edit Expense Entry (Admin)")
            .setView(box)
            .setPositiveButton("Save Changes") { _, _ ->
                val newAmt = amtInput.text.toString().toDoubleOrNull() ?: return@setPositiveButton
                val newDesc = descInput.text.toString().trim()
                val newDate = dateInput.text.toString().trim()
                val newPaidBy = if (trip.members.isNotEmpty()) {
                    trip.members[memberSpinner.selectedItemPosition].id
                } else {
                    exp.paidBy
                }

                executor.execute {
                    try {
                        ApiClient.editExpense(baseUrl, token, trip.id, exp.id, newPaidBy, newAmt, newDesc, newDate)
                        runOnUiThread {
                            Toast.makeText(this, "Expense updated!", Toast.LENGTH_SHORT).show()
                            showTripDetailScreen(trip.id)
                        }
                    } catch (e: Exception) {
                        runOnUiThread {
                            Toast.makeText(this, e.message, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun renderReportTab(
        parent: LinearLayout,
        trip: TripItem,
        report: TripReportData,
        isAdmin: Boolean
    ) {
        val token = accessToken ?: return

        // Summary Card
        val summaryCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg("#047857", "#047857", 16)
            setPadding(dp(18), dp(18), dp(18), dp(18))
        }
        val totalText = TextView(this).apply {
            text = "Total Spent: ${formatTaka(report.totalSpent)}"
            textSize = 22f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.WHITE)
        }
        val shareText = TextView(this).apply {
            text = "1 Person Share: ${formatTaka(report.perPersonShare)} (${report.totalPersons} total persons across ${report.memberCount} accounts)"
            textSize = 14f
            setTextColor(Color.parseColor("#D1FAE5"))
            setPadding(0, dp(4), 0, 0)
        }
        summaryCard.addView(totalText)
        summaryCard.addView(shareText)
        parent.addView(
            summaryCard,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        )

        // Settlement Plan Card
        val settleCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg("#FFFFFF", "#A7F3D0", 16)
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }
        val settleTitle = TextView(this).apply {
            text = "Settlement Plan (Who Owes Whom)"
            textSize = 17f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
            setPadding(0, 0, 0, dp(10))
        }
        settleCard.addView(settleTitle)

        if (report.settlements.isEmpty()) {
            val done = TextView(this).apply {
                text = "Everyone is settled up! No payments needed."
                setTextColor(Color.parseColor("#047857"))
            }
            settleCard.addView(done)
        } else {
            report.settlements.forEach { s ->
                val sRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    background = cardBg(
                        if (s.isPaid) "#ECFDF5" else "#F8FAFC",
                        if (s.isPaid) "#6EE7B7" else "#E2E8F0",
                        10
                    )
                    setPadding(dp(12), dp(10), dp(12), dp(10))
                }
                val sParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { bottomMargin = dp(8) }

                val label = TextView(this).apply {
                    text = "${s.fromUser} pays ${s.toUser}: ${formatTaka(s.amount)}"
                    textSize = 14f
                    setTypeface(typeface, Typeface.BOLD)
                    setTextColor(Color.parseColor(if (s.isPaid) "#047857" else "#0F172A"))
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                }
                sRow.addView(label)

                if (isAdmin) {
                    val paidBtn = Button(this).apply {
                        text = if (s.isPaid) "Paid ✓" else "Mark Paid"
                        isAllCaps = false
                        textSize = 11f
                        setOnClickListener {
                            executor.execute {
                                try {
                                    ApiClient.toggleSettlementPaid(
                                        baseUrl,
                                        token,
                                        trip.id,
                                        s.fromUser,
                                        s.toUser,
                                        !s.isPaid
                                    )
                                    runOnUiThread {
                                        showTripDetailScreen(trip.id)
                                    }
                                } catch (e: Exception) {
                                    runOnUiThread {
                                        Toast.makeText(this@MainActivity, e.message, Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        }
                    }
                    sRow.addView(paidBtn)
                } else {
                    val statusTag = TextView(this).apply {
                        text = if (s.isPaid) "Paid ✓" else "Pending"
                        textSize = 12f
                        setTypeface(typeface, Typeface.BOLD)
                        setTextColor(Color.parseColor(if (s.isPaid) "#047857" else "#B45309"))
                    }
                    sRow.addView(statusTag)
                }

                settleCard.addView(sRow, sParams)
            }
        }
        parent.addView(
            settleCard,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        )

        // Member Breakdown Card
        val memberCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg("#FFFFFF", "#E2E8F0", 16)
            setPadding(dp(16), dp(16), dp(16), dp(16))
        }
        val memberTitle = TextView(this).apply {
            text = "Member-Wise Spending Summary"
            textSize = 16f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#0F172A"))
            setPadding(0, 0, 0, dp(10))
        }
        memberCard.addView(memberTitle)

        report.userTotals.forEach { ut ->
            val uRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(8), 0, dp(8))
            }
            val uName = TextView(this).apply {
                text = "${ut.userName} (${ut.familyCount}x member)\nSpent: ${formatTaka(ut.totalSpent)}  •  Should Pay: ${formatTaka(ut.shouldPay)}"
                textSize = 13f
                setTextColor(Color.parseColor("#1E293B"))
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            val diffTag = TextView(this).apply {
                val d = ut.difference
                text = when {
                    d > 0.005 -> "Gets back +${formatTaka(d)}"
                    d < -0.005 -> "Owes -${formatTaka(Math.abs(d))}"
                    else -> "Settled (৳0)"
                }
                textSize = 13f
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(
                    Color.parseColor(
                        when {
                            d > 0.005 -> "#047857"
                            d < -0.005 -> "#DC2626"
                            else -> "#64748B"
                        }
                    )
                )
            }
            uRow.addView(uName)
            uRow.addView(diffTag)

            if (isAdmin && ut.userId.isNotBlank()) {
                val plusBtn = Button(this).apply {
                    text = "${ut.familyCount}p ±"
                    isAllCaps = false
                    textSize = 11f
                    setOnClickListener {
                        val numInput = EditText(this@MainActivity).apply {
                            setText(ut.familyCount.toString())
                            inputType = InputType.TYPE_CLASS_NUMBER
                        }
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("Family Members for ${ut.userName}")
                            .setMessage("Enter how many family members (1, 2, 3, 4...) are with ${ut.userName}:")
                            .setView(numInput)
                            .setPositiveButton("Update") { _, _ ->
                                val nextCount = numInput.text.toString().toIntOrNull() ?: 1
                                executor.execute {
                                    try {
                                        ApiClient.updateMemberFamilyCount(baseUrl, token, trip.id, ut.userId, nextCount)
                                        runOnUiThread { showTripDetailScreen(trip.id) }
                                    } catch (e: Exception) {
                                        runOnUiThread {
                                            Toast.makeText(this@MainActivity, e.message, Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            }
                            .setNegativeButton("Cancel", null)
                            .show()
                    }
                }
                uRow.addView(plusBtn)
            }

            memberCard.addView(uRow)
        }

        parent.addView(memberCard)
    }
}
