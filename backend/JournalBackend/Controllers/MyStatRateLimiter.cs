using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace JournalBackend.Controllers
{
    public static class MyStatRateLimiter
    {
        private static readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);
        private static DateTime _lastRequestTime = DateTime.MinValue;
        private static int _minIntervalMs = -1;

        public static int MinIntervalMs
        {
            get
            {
                if (_minIntervalMs == -1)
                {
                    _minIntervalMs = GetRateLimitFromEnv();
                }
                return _minIntervalMs;
            }
            set
            {
                _minIntervalMs = value;
            }
        }

        public static async Task<T> ExecuteSafeAsync<T>(Func<Task<T>> action)
        {
            await _semaphore.WaitAsync();
            try
            {
                var now = DateTime.UtcNow;
                var timeSinceLast = now - _lastRequestTime;
                var delayNeeded = MinIntervalMs - (int)timeSinceLast.TotalMilliseconds;

                if (delayNeeded > 0)
                {
                    await Task.Delay(delayNeeded);
                }

                _lastRequestTime = DateTime.UtcNow;
            }
            finally
            {
                _semaphore.Release();
            }

            return await action();
        }

        private static int GetRateLimitFromEnv()
        {
            var envVal = Environment.GetEnvironmentVariable("MYSTAT_RATE_LIMIT_MS");
            if (!string.IsNullOrEmpty(envVal) && int.TryParse(envVal, out var ms))
            {
                return ms;
            }

            var rootPath = FindProjectRoot();
            var envPath = Path.Combine(rootPath, ".env");
            if (File.Exists(envPath))
            {
                try
                {
                    foreach (var line in File.ReadLines(envPath))
                    {
                        var trimmed = line.Trim();
                        if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#")) continue;
                        var parts = trimmed.Split('=', 2);
                        if (parts.Length == 2 && parts[0].Trim() == "MYSTAT_RATE_LIMIT_MS")
                        {
                            var val = parts[1].Trim();
                            if (val.StartsWith("\"") && val.EndsWith("\"")) val = val.Substring(1, val.Length - 2);
                            if (val.StartsWith("'") && val.EndsWith("'")) val = val.Substring(1, val.Length - 2);
                            if (int.TryParse(val, out var parsedMs))
                            {
                                return parsedMs;
                            }
                        }
                    }
                }
                catch { }
            }

            // Default safe delay is 150ms
            return 150;
        }

        private static string FindProjectRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "run.bat")) || Directory.Exists(Path.Combine(dir.FullName, ".git")))
                {
                    return dir.FullName;
                }
                dir = dir.Parent;
            }
            return AppContext.BaseDirectory;
        }
    }
}
