package com.samadul.trip

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class UserProfile(
    val id: String,
    val fullName: String,
    val isAdmin: Boolean,
    val familyCount: Int = 1
)

data class TripItem(
    val id: String,
    val name: String,
    val isCompleted: Boolean,
    val memberCount: Int,
    val totalPersons: Int = 1,
    val totalSpent: Double,
    val createdAt: String,
    val members: List<UserProfile> = emptyList()
)

data class ExpenseItem(
    val id: String,
    val tripId: String,
    val paidBy: String,
    val userName: String,
    val amount: Double,
    val description: String,
    val date: String
)

data class UserTotalItem(
    val userId: String,
    val userName: String,
    val familyCount: Int,
    val totalSpent: Double,
    val shouldPay: Double,
    val difference: Double
)

data class SettlementItem(
    val fromUser: String,
    val toUser: String,
    val amount: Double,
    val isPaid: Boolean
)

data class TripReportData(
    val tripName: String,
    val isCompleted: Boolean,
    val totalSpent: Double,
    val perPersonShare: Double,
    val memberCount: Int,
    val totalPersons: Int,
    val userTotals: List<UserTotalItem>,
    val expenses: List<ExpenseItem>,
    val settlements: List<SettlementItem>
)

object ApiClient {

    fun request(
        baseUrl: String,
        path: String,
        method: String = "GET",
        token: String? = null,
        bodyJson: JSONObject? = null
    ): JSONObject {
        val cleanBase = baseUrl.trim().trimEnd('/')
        val url = URL("$cleanBase$path")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 15000
            useCaches = false
            setRequestProperty("Cache-Control", "no-cache")
            setRequestProperty("Accept", "application/json")
            if (!token.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer $token")
            }
            if (bodyJson != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            }
        }

        if (bodyJson != null) {
            OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(bodyJson.toString())
                writer.flush()
            }
        }

        val status = conn.responseCode
        val stream = if (status in 200..299) conn.inputStream else conn.errorStream
        val responseText = stream?.let {
            BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { r -> r.readText() }
        } ?: "{}"

        val json = try {
            JSONObject(responseText)
        } catch (_: Exception) {
            JSONObject().put("error", "Invalid server response ($status)")
        }

        if (status !in 200..299) {
            val errMsg = json.optString("error", "Request failed with HTTP $status")
            throw Exception(errMsg)
        }

        return json
    }

    fun login(baseUrl: String, username: String, password: String): Pair<String, UserProfile> {
        val body = JSONObject()
            .put("username", username)
            .put("password", password)
        val res = request(baseUrl, "/api/auth/login", "POST", null, body)
        val token = res.getString("access_token")
        val userObj = res.getJSONObject("user")
        val fullName = userObj.getString("full_name")
        val isAdmin = userObj.optBoolean("is_admin", fullName.equals("Samadul", ignoreCase = true))
        return token to UserProfile(
            id = userObj.getString("id"),
            fullName = fullName,
            isAdmin = isAdmin
        )
    }

    fun getTrips(baseUrl: String, token: String): List<TripItem> {
        val res = request(baseUrl, "/api/trips", "GET", token)
        val arr = res.optJSONArray("trips") ?: JSONArray()
        val list = mutableListOf<TripItem>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            list.add(
                TripItem(
                    id = o.getString("id"),
                    name = o.getString("name"),
                    isCompleted = o.optBoolean("is_completed", false),
                    memberCount = o.optInt("member_count", 1),
                    totalSpent = o.optDouble("total_spent", 0.0),
                    createdAt = o.optString("created_at", "")
                )
            )
        }
        return list
    }

    fun getUsers(baseUrl: String, token: String): List<UserProfile> {
        val res = request(baseUrl, "/api/users", "GET", token)
        val arr = res.optJSONArray("users") ?: JSONArray()
        val list = mutableListOf<UserProfile>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val name = o.getString("full_name")
            list.add(
                UserProfile(
                    id = o.getString("id"),
                    fullName = name,
                    isAdmin = name.equals("Samadul", ignoreCase = true)
                )
            )
        }
        return list
    }

    fun createTrip(baseUrl: String, token: String, name: String, memberIds: List<String>): TripItem {
        val idsArray = JSONArray()
        memberIds.forEach { idsArray.put(it) }
        val body = JSONObject()
            .put("name", name)
            .put("member_ids", idsArray)
        val res = request(baseUrl, "/api/trips", "POST", token, body)
        val t = res.getJSONObject("trip")
        return TripItem(
            id = t.getString("id"),
            name = t.getString("name"),
            isCompleted = t.optBoolean("is_completed", false),
            memberCount = memberIds.size + 1,
            totalSpent = 0.0,
            createdAt = t.optString("created_at", "")
        )
    }

    fun getTripDetail(baseUrl: String, token: String, tripId: String): TripItem {
        val res = request(baseUrl, "/api/trips/$tripId", "GET", token)
        val t = res.getJSONObject("trip")
        val membersArr = t.optJSONArray("members") ?: JSONArray()
        val members = mutableListOf<UserProfile>()
        for (i in 0 until membersArr.length()) {
            val m = membersArr.getJSONObject(i)
            val mName = m.getString("full_name")
            members.add(
                UserProfile(
                    id = m.getString("id"),
                    fullName = mName,
                    isAdmin = mName.equals("Samadul", ignoreCase = true),
                    familyCount = m.optInt("family_count", 1)
                )
            )
        }
        return TripItem(
            id = t.getString("id"),
            name = t.getString("name"),
            isCompleted = t.optBoolean("is_completed", false),
            memberCount = t.optInt("member_count", members.size),
            totalPersons = t.optInt("total_persons", members.sumOf { it.familyCount }),
            totalSpent = 0.0,
            createdAt = t.optString("created_at", ""),
            members = members
        )
    }

    fun updateMemberFamilyCount(
        baseUrl: String,
        token: String,
        tripId: String,
        memberUserId: String,
        familyCount: Int
    ) {
        val body = JSONObject()
            .put("member_user_id", memberUserId)
            .put("family_count", familyCount)
        request(baseUrl, "/api/trips/$tripId", "PATCH", token, body)
    }

    fun updateTripStatus(baseUrl: String, token: String, tripId: String, isCompleted: Boolean) {
        val body = JSONObject().put("is_completed", isCompleted)
        request(baseUrl, "/api/trips/$tripId", "PATCH", token, body)
    }

    fun getExpenses(baseUrl: String, token: String, tripId: String): List<ExpenseItem> {
        val res = request(baseUrl, "/api/trips/$tripId/expenses", "GET", token)
        val arr = res.optJSONArray("expenses") ?: JSONArray()
        val list = mutableListOf<ExpenseItem>()
        for (i in 0 until arr.length()) {
            val e = arr.getJSONObject(i)
            list.add(
                ExpenseItem(
                    id = e.optString("id", ""),
                    tripId = tripId,
                    paidBy = e.optString("paid_by", ""),
                    userName = e.optString("user_name", "Unknown"),
                    amount = e.optDouble("amount", 0.0),
                    description = e.optString("description", ""),
                    date = e.optString("expense_date", e.optString("date", ""))
                )
            )
        }
        return list
    }

    fun addExpense(
        baseUrl: String,
        token: String,
        tripId: String,
        amount: Double,
        description: String,
        expenseDate: String,
        paidBy: String?
    ) {
        val body = JSONObject()
            .put("amount", amount)
            .put("description", description)
            .put("expense_date", expenseDate)
        if (!paidBy.isNullOrBlank()) {
            body.put("paid_by", paidBy)
        }
        request(baseUrl, "/api/trips/$tripId/expenses", "POST", token, body)
    }

    fun editExpense(
        baseUrl: String,
        token: String,
        tripId: String,
        expenseId: String,
        paidBy: String,
        amount: Double,
        description: String,
        expenseDate: String
    ) {
        val body = JSONObject()
            .put("expense_id", expenseId)
            .put("paid_by", paidBy)
            .put("amount", amount)
            .put("description", description)
            .put("expense_date", expenseDate)
        request(baseUrl, "/api/trips/$tripId/expenses", "PUT", token, body)
    }

    fun deleteExpense(baseUrl: String, token: String, tripId: String, expenseId: String) {
        val encoded = URLEncoder.encode(expenseId, "UTF-8")
        request(baseUrl, "/api/trips/$tripId/expenses?expense_id=$encoded", "DELETE", token)
    }

    fun getReport(baseUrl: String, token: String, tripId: String): TripReportData {
        val res = request(baseUrl, "/api/trips/$tripId/report", "GET", token)
        val utArr = res.optJSONArray("user_totals") ?: JSONArray()
        val userTotals = mutableListOf<UserTotalItem>()
        val share = res.optDouble("per_person_share", 0.0)
        for (i in 0 until utArr.length()) {
            val u = utArr.getJSONObject(i)
            val fCount = u.optInt("family_count", 1)
            val spent = u.optDouble("total_spent", 0.0)
            val shouldPay = u.optDouble("should_pay", share * fCount)
            val diff = if (u.has("difference")) u.optDouble("difference", 0.0) else (spent - shouldPay)
            userTotals.add(
                UserTotalItem(
                    userId = u.optString("user_id", ""),
                    userName = u.optString("user_name", "Unknown"),
                    familyCount = fCount,
                    totalSpent = spent,
                    shouldPay = shouldPay,
                    difference = diff
                )
            )
        }

        val expArr = res.optJSONArray("expenses") ?: JSONArray()
        val expenses = mutableListOf<ExpenseItem>()
        for (i in 0 until expArr.length()) {
            val e = expArr.getJSONObject(i)
            expenses.add(
                ExpenseItem(
                    id = e.optString("id", ""),
                    tripId = tripId,
                    paidBy = e.optString("paid_by", ""),
                    userName = e.optString("user_name", "Unknown"),
                    amount = e.optDouble("amount", 0.0),
                    description = e.optString("description", ""),
                    date = e.optString("date", e.optString("expense_date", ""))
                )
            )
        }

        val setArr = res.optJSONArray("settlement") ?: JSONArray()
        val settlements = mutableListOf<SettlementItem>()
        for (i in 0 until setArr.length()) {
            val s = setArr.getJSONObject(i)
            settlements.add(
                SettlementItem(
                    fromUser = s.optString("from_user", ""),
                    toUser = s.optString("to_user", ""),
                    amount = s.optDouble("amount", 0.0),
                    isPaid = s.optBoolean("is_paid", false)
                )
            )
        }

        return TripReportData(
            tripName = res.optString("trip_name", "Trip"),
            isCompleted = res.optBoolean("is_completed", false),
            totalSpent = res.optDouble("total_spent", 0.0),
            perPersonShare = share,
            memberCount = res.optInt("member_count", 1),
            totalPersons = res.optInt("total_persons", res.optInt("member_count", 1)),
            userTotals = userTotals,
            expenses = expenses,
            settlements = settlements
        )
    }

    fun toggleSettlementPaid(
        baseUrl: String,
        token: String,
        tripId: String,
        fromUser: String,
        toUser: String,
        isPaid: Boolean
    ) {
        val body = JSONObject()
            .put("from_user", fromUser)
            .put("to_user", toUser)
            .put("is_paid", isPaid)
        request(baseUrl, "/api/trips/$tripId/report", "PATCH", token, body)
    }
}

