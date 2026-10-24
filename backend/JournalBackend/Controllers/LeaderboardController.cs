using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using JournalBackend.Database;
using JournalBackend.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Caching.Memory;
using JournalBackend.Services.Security;

namespace JournalBackend.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class LeaderboardController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IMemoryCache _cache;
        private readonly IExternalCredentialProtector _externalCredentials;
        private static readonly System.Threading.SemaphoreSlim _tokenRefreshSemaphore = new System.Threading.SemaphoreSlim(1, 1);

        public LeaderboardController(AppDbContext context, IConfiguration configuration, IMemoryCache cache, IExternalCredentialProtector externalCredentials)
        {
            _context = context;
            _configuration = configuration;
            _cache = cache;
            _externalCredentials = externalCredentials;
        }

        [HttpGet("group")]
        public async Task<IActionResult> GetGroupLeaderboard()
        {
            return await GetLeaderboardAsync("/dashboard/progress/leader-group");
        }

        [HttpGet("stream")]
        public async Task<IActionResult> GetStreamLeaderboard()
        {
            return await GetLeaderboardAsync("/dashboard/progress/leader-stream");
        }

        [HttpGet("average-grade")]
        public async Task<IActionResult> GetAverageGrade()
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден в авторизованной сессии." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            // Fetch visits and leaderboard in parallel
            var visitsTask = GetVisitsWithCacheAsync(user);
            var leaderTask = MakeMyStatRequestAsync(user, "/dashboard/progress/leader-group");

            await Task.WhenAll(visitsTask, leaderTask);

            string visitsContent;
            try
            {
                visitsContent = await visitsTask;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Ошибка при загрузке посещений: {ex.Message}" });
            }

            var (leaderRes, leaderContent) = await leaderTask;
            if (!leaderRes.IsSuccessStatusCode)
            {
                return StatusCode((int)leaderRes.StatusCode, new { message = $"Ошибка API Академии (лидерборд): {leaderContent}" });
            }

            // 1. Group marks by month (yyyy-MM)
            var monthlyMarks = new Dictionary<string, List<double>>();
            using (var visitsDoc = JsonDocument.Parse(visitsContent))
            {
                if (visitsDoc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in visitsDoc.RootElement.EnumerateArray())
                    {
                        if (item.TryGetProperty("date_visit", out var dateProp) && dateProp.ValueKind == JsonValueKind.String)
                        {
                            var dateStr = dateProp.GetString();
                            if (DateTime.TryParse(dateStr, out var dateVisit))
                            {
                                string monthKey = dateVisit.ToString("yyyy-MM");
                                if (!monthlyMarks.ContainsKey(monthKey))
                                {
                                    monthlyMarks[monthKey] = new List<double>();
                                }

                                string[] markFields = {
                                    "control_work_mark",
                                    "home_work_mark",
                                    "lab_work_mark",
                                    "class_work_mark",
                                    "practical_work_mark",
                                    "final_work_mark"
                                };

                                foreach (var field in markFields)
                                {
                                    if (item.TryGetProperty(field, out var markProp) && markProp.ValueKind == JsonValueKind.Number)
                                    {
                                        monthlyMarks[monthKey].Add(markProp.GetDouble());
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 2. Generate chart data (months of current semester)
            var chartData = new List<double>();
            var months = new List<string>();
            var monthNames = new[] { "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек" };

            var semesterStart = GetSemesterStart();
            var now = DateTime.Now;

            var current = new DateTime(semesterStart.Year, semesterStart.Month, 1);
            var end = new DateTime(now.Year, now.Month, 1);

            while (current <= end)
            {
                string key = current.ToString("yyyy-MM");
                if (monthlyMarks.TryGetValue(key, out var marks) && marks.Count > 0)
                {
                    double avg = marks.Average();
                    chartData.Add(Math.Round(avg, 2));
                    months.Add(monthNames[current.Month - 1]);
                }
                current = current.AddMonths(1);
            }

            // Fallback: get the last 6 months with data from monthlyMarks if current semester has none
            if (chartData.Count == 0)
            {
                var activeMonths = monthlyMarks
                    .Where(kvp => kvp.Value.Count > 0)
                    .Select(kvp => kvp.Key)
                    .OrderBy(m => m)
                    .TakeLast(6)
                    .ToList();

                foreach (var mKey in activeMonths)
                {
                    if (DateTime.TryParse(mKey + "-01", out var parsedDate))
                    {
                        double avg = monthlyMarks[mKey].Average();
                        chartData.Add(Math.Round(avg, 2));
                        months.Add(monthNames[parsedDate.Month - 1]);
                    }
                }
            }

            // 3. Calculate main grade for current month, falling back to latest active month
            double grade = 0.0;
            string currentMonthKey = now.ToString("yyyy-MM");
            if (monthlyMarks.TryGetValue(currentMonthKey, out var currentMonthMarks) && currentMonthMarks.Count > 0)
            {
                grade = Math.Round(currentMonthMarks.Average(), 2);
            }
            else
            {
                var latestActiveMonth = monthlyMarks
                    .Where(kvp => kvp.Value.Count > 0)
                    .OrderBy(kvp => kvp.Key)
                    .LastOrDefault();

                if (latestActiveMonth.Value != null && latestActiveMonth.Value.Count > 0)
                {
                    grade = Math.Round(latestActiveMonth.Value.Average(), 2);
                }
            }

            // 4. Calculate trend
            string trendText = "Текущий тренд стабильный";
            if (chartData.Count >= 2)
            {
                double lastVal = chartData[chartData.Count - 1];
                double prevVal = chartData[chartData.Count - 2];
                if (lastVal > prevVal && prevVal > 0)
                {
                    trendText = "Текущий тренд: восходящий";
                }
                else if (lastVal < prevVal && lastVal > 0)
                {
                    trendText = "Текущий тренд: нисходящий";
                }
            }

            // 5. Calculate grade status text
            string gradeStatusText = "Удовлетворительная успеваемость";
            if (grade >= 4.5) gradeStatusText = "Отличная учеба";
            else if (grade >= 3.8) gradeStatusText = "Хорошая учеба";
            else if (grade > 0) gradeStatusText = "Требуется внимание";

            // 6. Parse leaderboard rank
            int? studentId = GetStudentIdFromToken(user.JournalToken);
            string rankText = "Группа успеваемости";

            using (var leaderDoc = JsonDocument.Parse(leaderContent))
            {
                if (leaderDoc.RootElement.ValueKind == JsonValueKind.Array && studentId.HasValue)
                {
                    int rank = 0;
                    foreach (var item in leaderDoc.RootElement.EnumerateArray())
                    {
                        if (item.TryGetProperty("id", out var idProp) && idProp.ValueKind == JsonValueKind.Number && idProp.GetInt32() == studentId.Value)
                        {
                            if (item.TryGetProperty("position", out var posProp) && posProp.ValueKind == JsonValueKind.Number)
                            {
                                rank = posProp.GetInt32();
                                break;
                            }
                        }
                    }
                    if (rank > 0)
                    {
                        rankText = $"Топ-{rank} группы по успеваемости";
                    }
                }
            }

            return Ok(new
            {
                grade,
                trendText,
                gradeStatusText,
                rankText,
                chartData,
                months
            });
        }

        [HttpGet("visits")]
        public async Task<IActionResult> GetVisits([FromQuery] bool? bypassCache)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден в авторизованной сессии." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            try
            {
                string visitsContent = await GetVisitsWithCacheAsync(user, bypassCache);
                return Content(visitsContent, "application/json");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Ошибка при получении посещений: {ex.Message}" });
            }
        }

        [HttpGet("attendance")]
        public async Task<IActionResult> GetAttendance()
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден в авторизованной сессии." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            // Fetch everything in parallel
            var statTask = MakeMyStatRequestAsync(user, "/dashboard/progress/attendance-statistic");
            var chartTask = MakeMyStatRequestAsync(user, "/dashboard/chart/attendance");
            var visitsTask = GetVisitsWithCacheAsync(user);

            await Task.WhenAll(statTask, chartTask, visitsTask);

            var (statRes, statContent) = await statTask;
            if (!statRes.IsSuccessStatusCode)
            {
                return StatusCode((int)statRes.StatusCode, new { message = $"Ошибка API Академии (статистика посещаемости): {statContent}" });
            }

            var (chartRes, chartContent) = await chartTask;
            if (!chartRes.IsSuccessStatusCode)
            {
                return StatusCode((int)chartRes.StatusCode, new { message = $"Ошибка API Академии (график посещаемости): {chartContent}" });
            }

            string visitsContent;
            try
            {
                visitsContent = await visitsTask;
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }

            // Parse attendance statistic
            int attendancePercent = 0;
            using (var statDoc = JsonDocument.Parse(statContent))
            {
                if (statDoc.RootElement.TryGetProperty("statTotal", out var statTotalProp) && statTotalProp.ValueKind == JsonValueKind.Number)
                {
                    attendancePercent = statTotalProp.GetInt32();
                }
            }

            // Parse visits to count total/missed classes for current academic year (from Sep 1st)
            int totalClasses = 0;
            int missed = 0;

            using (var visitsDoc = JsonDocument.Parse(visitsContent))
            {
                if (visitsDoc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    var now = DateTime.Now;
                    int startYear = now.Month >= 9 ? now.Year : now.Year - 1;
                    var academicYearStart = new DateTime(startYear, 9, 1);

                    foreach (var item in visitsDoc.RootElement.EnumerateArray())
                    {
                        if (item.TryGetProperty("date_visit", out var dateVisitProp) && dateVisitProp.ValueKind == JsonValueKind.String)
                        {
                            var dateStr = dateVisitProp.GetString() ?? "";
                            if (DateTime.TryParse(dateStr, out var dateVisit))
                            {
                                if (dateVisit >= academicYearStart)
                                {
                                    if (item.TryGetProperty("status_was", out var statusProp))
                                    {
                                        if (statusProp.ValueKind == JsonValueKind.Number)
                                        {
                                            int status = statusProp.GetInt32();
                                            if (status == 0 || status == 1 || status == 2)
                                            {
                                                totalClasses++;
                                                if (status == 0)
                                                {
                                                    missed++;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Parse chart attendance
            var chartData = new List<int>();
            var months = new List<string>();
            var monthNames = new[] { "Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек" };

            using (var chartDoc = JsonDocument.Parse(chartContent))
            {
                if (chartDoc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    var chartList = chartDoc.RootElement.EnumerateArray().ToList();
                    var semesterStart = GetSemesterStart();

                    foreach (var node in chartList)
                    {
                        if (node.TryGetProperty("date", out var dateProp) && dateProp.ValueKind == JsonValueKind.String)
                        {
                            var dateStr = dateProp.GetString() ?? "";
                            if (DateTime.TryParse(dateStr, out var parsedDate))
                            {
                                if (parsedDate >= semesterStart)
                                {
                                    int pts = node.TryGetProperty("points", out var lp) && lp.ValueKind == JsonValueKind.Number ? lp.GetInt32() : 0;
                                    chartData.Add(pts);
                                    string monthAbbr = monthNames[parsedDate.Month - 1];
                                    months.Add(monthAbbr);
                                }
                            }
                        }
                    }

                    // Fallback if current semester doesn't have chart data yet
                    if (chartData.Count == 0)
                    {
                        int takeCount = Math.Min(6, chartList.Count);
                        var recentNodes = chartList.Skip(chartList.Count - takeCount).ToList();

                        foreach (var node in recentNodes)
                        {
                            int pts = node.TryGetProperty("points", out var lp) && lp.ValueKind == JsonValueKind.Number ? lp.GetInt32() : 0;
                            chartData.Add(pts);

                            string monthAbbr = "";
                            if (node.TryGetProperty("date", out var dateProp) && dateProp.ValueKind == JsonValueKind.String)
                            {
                                var dateStr = dateProp.GetString() ?? "";
                                if (DateTime.TryParse(dateStr, out var parsedDate))
                                {
                                    monthAbbr = monthNames[parsedDate.Month - 1];
                                }
                            }
                            months.Add(monthAbbr);
                        }
                    }
                }
            }

            // Compute monthly diff based on actual chart data (last month vs previous month)
            int diffMonthVal = 0;
            if (chartData.Count >= 2)
            {
                diffMonthVal = chartData[chartData.Count - 1] - chartData[chartData.Count - 2];
            }
            else
            {
                using (var statDoc = JsonDocument.Parse(statContent))
                {
                    if (statDoc.RootElement.TryGetProperty("diffMonth", out var diffMonthProp) && diffMonthProp.ValueKind == JsonValueKind.Number)
                    {
                        diffMonthVal = diffMonthProp.GetInt32();
                    }
                }
            }

            string diffText = diffMonthVal >= 0 ? $"+{diffMonthVal}% за месяц" : $"{diffMonthVal}% за месяц";

            return Ok(new
            {
                attendancePercent,
                diffText,
                totalClasses,
                missed,
                chartData,
                months
            });
        }

        private async Task<(HttpResponseMessage Response, string Content)> MakeMyStatRequestAsync(User user, string relativeUrl)
        {
            string responseString = "";
            HttpResponseMessage response;
            string tokenUsed = user.JournalToken ?? "";
            using (var client = CreateHttpClient())
            {
                SetupHeaders(client, tokenUsed);
                response = await MyStatRateLimiter.ExecuteSafeAsync(() => client.GetAsync($"https://msapi.top-academy.ru/api/v2{relativeUrl}"));
                responseString = await response.Content.ReadAsStringAsync();

                if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    // Token expired/invalid, try to refresh safely with semaphore
                    var refreshed = await RefreshJournalTokenAsync(user, tokenUsed);
                    if (refreshed)
                    {
                        // Retry with new token
                        using var retryClient = CreateHttpClient();
                        SetupHeaders(retryClient, user.JournalToken ?? "");
                        response = await MyStatRateLimiter.ExecuteSafeAsync(() => retryClient.GetAsync($"https://msapi.top-academy.ru/api/v2{relativeUrl}"));
                        responseString = await response.Content.ReadAsStringAsync();
                    }
                }
            }
            return (response, responseString);
        }

        private async Task<string> GetVisitsWithCacheAsync(User user, bool? bypassCache = false)
        {
            string cacheKey = $"visits_cache_{user.Id}";
            if (bypassCache != true && _cache.TryGetValue(cacheKey, out string? cachedVisits) && cachedVisits != null)
            {
                return cachedVisits;
            }

            var (response, content) = await MakeMyStatRequestAsync(user, "/progress/operations/student-visits");
            if (response.IsSuccessStatusCode)
            {
                var cacheEntryOptions = new MemoryCacheEntryOptions()
                    .SetAbsoluteExpiration(TimeSpan.FromMinutes(30));
                _cache.Set(cacheKey, content, cacheEntryOptions);
                return content;
            }

            throw new Exception($"Не удалось загрузить данные о посещаемости: {content}");
        }

        [HttpGet("activity")]
        public async Task<IActionResult> GetActivity()
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден в авторизованной сессии." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            // 3. Make the API call, auto-refreshing token on 401 using the semaphore-wrapped helper
            var (response, responseString) = await MakeMyStatRequestAsync(user, "/dashboard/progress/activity");

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, new { message = $"Ошибка API Академии: {responseString}" });
            }

            // 4. Parse and return mapped data
            using var doc = JsonDocument.Parse(responseString);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Ok(new object[0]);
            }

            var mappedList = doc.RootElement.EnumerateArray().Select(item => {
                string date = item.TryGetProperty("date", out var dateProp) && dateProp.ValueKind == JsonValueKind.String ? dateProp.GetString() ?? "" : "";
                int currentPoint = item.TryGetProperty("current_point", out var ptProp) && ptProp.ValueKind == JsonValueKind.Number ? ptProp.GetInt32() : 0;
                string rawPtName = item.TryGetProperty("point_types_name", out var typeProp) && typeProp.ValueKind == JsonValueKind.String ? typeProp.GetString() ?? "" : "";
                string ptName = rawPtName == "DIAMOND" ? "COIN" : (rawPtName == "COIN" ? "DIAMOND" : rawPtName);
                string achieveName = item.TryGetProperty("achievements_name", out var achProp) && achProp.ValueKind == JsonValueKind.String ? achProp.GetString() ?? "" : "";
                int action = item.TryGetProperty("action", out var actionProp) && actionProp.ValueKind == JsonValueKind.Number ? actionProp.GetInt32() : 1;
                int badge = item.TryGetProperty("badge", out var badgeProp) && badgeProp.ValueKind == JsonValueKind.Number ? badgeProp.GetInt32() : 0;

                return new
                {
                    date = date,
                    amount = currentPoint,
                    type = ptName,
                    achievementName = achieveName,
                    action = action,
                    badge = badge
                };
            }).ToList();

            return Ok(mappedList);
        }

        [HttpGet("exams")]
        public async Task<IActionResult> GetExams([FromQuery] bool? bypassCache)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден в авторизованной сессии." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            try
            {
                string cacheKey = $"exams_cache_{user.Id}";
                if (bypassCache != true && _cache.TryGetValue(cacheKey, out string? cachedExams) && cachedExams != null)
                {
                    return Content(cachedExams, "application/json");
                }

                var (response, content) = await MakeMyStatRequestAsync(user, "/progress/operations/student-exams");
                if (response.IsSuccessStatusCode)
                {
                    var cacheEntryOptions = new MemoryCacheEntryOptions()
                        .SetAbsoluteExpiration(TimeSpan.FromMinutes(30));
                    _cache.Set(cacheKey, content, cacheEntryOptions);
                    return Content(content, "application/json");
                }

                return StatusCode((int)response.StatusCode, new { message = $"Ошибка API Академии (экзамены): {content}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Ошибка при получении экзаменов: {ex.Message}" });
            }
        }

        [HttpGet("future-exams")]
        public async Task<IActionResult> GetFutureExams([FromQuery] bool? bypassCache)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден в авторизованной сессии." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            try
            {
                string cacheKey = $"future_exams_cache_{user.Id}";
                if (bypassCache != true && _cache.TryGetValue(cacheKey, out string? cachedFutureExams) && cachedFutureExams != null)
                {
                    return Content(cachedFutureExams, "application/json");
                }

                var (response, content) = await MakeMyStatRequestAsync(user, "/dashboard/info/future-exams");
                if (response.IsSuccessStatusCode)
                {
                    var cacheEntryOptions = new MemoryCacheEntryOptions()
                        .SetAbsoluteExpiration(TimeSpan.FromMinutes(30));
                    _cache.Set(cacheKey, content, cacheEntryOptions);
                    return Content(content, "application/json");
                }

                return StatusCode((int)response.StatusCode, new { message = $"Ошибка API Академии (будущие экзамены): {content}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Ошибка при получении будущих экзаменов: {ex.Message}" });
            }
        }

        private async Task<IActionResult> GetLeaderboardAsync(string apiEndpoint)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return Unauthorized(new { message = "Пользователь не найден в авторизованной сессии." });
            }

            if (string.IsNullOrEmpty(user.JournalToken))
            {
                return BadRequest(new { message = "Дневник не привязан к аккаунту." });
            }

            // 3. Make the API call, auto-refreshing token on 401 using the semaphore-wrapped helper
            var (response, responseString) = await MakeMyStatRequestAsync(user, apiEndpoint);

            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode, new { message = $"Ошибка API Академии: {responseString}" });
            }

            // 4. Extract student ID from JWT
            int? studentId = GetStudentIdFromToken(user.JournalToken);

            // 5. Parse and map response
            using var doc = JsonDocument.Parse(responseString);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return Ok(new object[0]);
            }

            var mappedList = doc.RootElement.EnumerateArray().Select(item => {
                bool isDivider = !item.TryGetProperty("id", out var idProp) || idProp.ValueKind == JsonValueKind.Null;
                int id = !isDivider && idProp.ValueKind == JsonValueKind.Number ? idProp.GetInt32() : 0;
                int amount = item.TryGetProperty("amount", out var amountProp) && amountProp.ValueKind == JsonValueKind.Number ? amountProp.GetInt32() : 0;
                string fullName = item.TryGetProperty("full_name", out var nameProp) && nameProp.ValueKind == JsonValueKind.String ? nameProp.GetString() ?? "" : "";
                string photoPath = item.TryGetProperty("photo_path", out var photoProp) && photoProp.ValueKind == JsonValueKind.String ? photoProp.GetString() ?? "" : "";
                int position = item.TryGetProperty("position", out var posProp) && posProp.ValueKind == JsonValueKind.Number ? posProp.GetInt32() : 0;

                return new
                {
                    rank = position,
                    name = fullName,
                    points = amount,
                    avatar = photoPath,
                    isSelf = !isDivider && studentId.HasValue && id == studentId.Value,
                    hasIncrease = false,
                    isDivider = isDivider
                };
            }).ToList();

            return Ok(mappedList);
        }

        private void SetupHeaders(HttpClient client, string token)
        {
            client.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
            client.DefaultRequestHeaders.Add("Referer", "https://journal.top-academy.ru/");
            client.DefaultRequestHeaders.Add("Origin", "https://journal.top-academy.ru");
            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");
        }

        private async Task<bool> RefreshJournalTokenAsync(User user, string tokenUsed)
        {
            await _tokenRefreshSemaphore.WaitAsync();
            try
            {
                // Double-check: has another parallel task already refreshed the token?
                if (user.JournalToken != tokenUsed)
                {
                    return true;
                }

                // Reload user entity from database to pick up changes from other concurrent HTTP requests
                await _context.Entry(user).ReloadAsync();
                if (user.JournalToken != tokenUsed)
                {
                    return true;
                }

                if (string.IsNullOrEmpty(user.Login) || string.IsNullOrEmpty(user.ExternalPassword))
                {
                    return false;
                }

                var appKey = GetApplicationKey();
                if (string.IsNullOrEmpty(appKey))
                {
                    return false;
                }

                var authResult = await CallTopAcademyAuthAsync(user.Login, _externalCredentials.Unprotect(user.ExternalPassword)!, appKey);
                if (authResult.Success)
                {
                    user.JournalToken = authResult.Token;
                    await _context.SaveChangesAsync();
                    return true;
                }

                return false;
            }
            finally
            {
                _tokenRefreshSemaphore.Release();
            }
        }

        private string FindProjectRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (System.IO.File.Exists(Path.Combine(dir.FullName, "run.bat")) || Directory.Exists(Path.Combine(dir.FullName, ".git")))
                {
                    return dir.FullName;
                }
                dir = dir.Parent;
            }
            return AppContext.BaseDirectory;
        }

        private string GetApplicationKey()
        {
            var rootPath = FindProjectRoot();
            
            // 1. Try to load from root .env
            var envPath = Path.Combine(rootPath, ".env");
            if (System.IO.File.Exists(envPath))
            {
                try
                {
                    foreach (var line in System.IO.File.ReadLines(envPath))
                    {
                        var trimmed = line.Trim();
                        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
                        var parts = trimmed.Split('=', 2);
                        if (parts.Length == 2 && parts[0].Trim() == "APPLICATION_KEY")
                        {
                            var val = parts[1].Trim();
                            if (val.StartsWith("\"") && val.EndsWith("\"")) val = val.Substring(1, val.Length - 2);
                            if (val.StartsWith("'") && val.EndsWith("'")) val = val.Substring(1, val.Length - 2);
                            return val;
                        }
                    }
                }
                catch { }
            }

            // 2. Try to load from bot/.env
            var botEnvPath = Path.Combine(rootPath, "bot", ".env");
            if (System.IO.File.Exists(botEnvPath))
            {
                try
                {
                    foreach (var line in System.IO.File.ReadLines(botEnvPath))
                    {
                        var trimmed = line.Trim();
                        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
                        var parts = trimmed.Split('=', 2);
                        if (parts.Length == 2 && parts[0].Trim() == "APPLICATION_KEY")
                        {
                            var val = parts[1].Trim();
                            if (val.StartsWith("\"") && val.EndsWith("\"")) val = val.Substring(1, val.Length - 2);
                            if (val.StartsWith("'") && val.EndsWith("'")) val = val.Substring(1, val.Length - 2);
                            return val;
                        }
                    }
                }
                catch { }
            }

            // 3. Fallback to appsettings.json configuration
            var configKey = _configuration["Journal:ApplicationKey"];
            if (!string.IsNullOrEmpty(configKey))
            {
                return configKey;
            }

            return string.Empty;
        }

        private async Task<(bool Success, string Token, string ErrorMessage)> CallTopAcademyAuthAsync(string username, string password, string appKey)
        {
            try
            {
                using var client = CreateHttpClient();
                
                client.DefaultRequestHeaders.Add("Accept", "application/json, text/plain, */*");
                client.DefaultRequestHeaders.Add("Referer", "https://journal.top-academy.ru/");
                client.DefaultRequestHeaders.Add("Origin", "https://journal.top-academy.ru");
                client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                var payload = new
                {
                    application_key = appKey,
                    id_city = (int?)null,
                    username = username,
                    password = password
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await MyStatRateLimiter.ExecuteSafeAsync(() => client.PostAsync("https://msapi.top-academy.ru/api/v2/auth/login", content));
                var responseString = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    using var doc = JsonDocument.Parse(responseString);
                    if (doc.RootElement.TryGetProperty("access_token", out var tokenProp))
                    {
                        return (true, tokenProp.GetString() ?? string.Empty, string.Empty);
                    }
                    return (false, string.Empty, "Токен не найден в ответе сервера.");
                }
                else
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(responseString);
                        if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                        {
                            var firstErr = doc.RootElement[0];
                            if (firstErr.TryGetProperty("message", out var msgProp))
                            {
                                return (false, string.Empty, msgProp.GetString() ?? "Ошибка авторизации");
                            }
                        }
                        else if (doc.RootElement.TryGetProperty("message", out var msgProp))
                        {
                            return (false, string.Empty, msgProp.GetString() ?? "Ошибка авторизации");
                        }
                    }
                    catch { }

                    return (false, string.Empty, string.IsNullOrEmpty(responseString) ? $"Ошибка сервера: {response.StatusCode}" : responseString);
                }
            }
            catch (Exception ex)
            {
                return (false, string.Empty, $"Ошибка подключения к API Академии: {ex.Message}");
            }
        }

        private int? GetStudentIdFromToken(string token)
        {
            try
            {
                var parts = token.Split('.');
                if (parts.Length < 2) return null;
                var payload = parts[1];
                
                var padLen = (4 - (payload.Length % 4)) % 4;
                if (padLen > 0)
                {
                    payload += new string('=', padLen);
                }
                
                var bytes = Convert.FromBase64String(payload.Replace('-', '+').Replace('_', '/'));
                var json = Encoding.UTF8.GetString(bytes);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("userId", out var userIdProp))
                {
                    return userIdProp.GetInt32();
                }
            }
            catch { }
            return null;
        }

        private HttpClient CreateHttpClient()
        {
            // Use the platform defaults, including TLS certificate validation.
            return new HttpClient();
        }

        private DateTime GetSemesterStart()
        {
            var now = DateTime.Now;
            if (now.Month >= 9 && now.Month <= 11)
            {
                return new DateTime(now.Year, 9, 1);
            }
            else if (now.Month == 12)
            {
                return new DateTime(now.Year, 12, 1);
            }
            else // 1 to 8 (January to August)
            {
                return new DateTime(now.Year - 1, 12, 1);
            }
        }

        private async Task<User?> GetCurrentUserAsync()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(idClaim, out var userId))
            {
                return null;
            }

            return await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
        }
    }
}
