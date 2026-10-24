using System.Reflection;
using JournalBackend.Controllers;
using JournalBackend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace JournalBackend.Tests;

public sealed class AuthorizationSurfaceTests
{
    private static readonly HashSet<string> LegacySessionControllers = new(StringComparer.Ordinal)
    {
        nameof(AuthController),
        nameof(HomeworkController),
        nameof(LeaderboardController),
        nameof(ScheduleController)
    };

    [Fact]
    public void SecuredControllers_DoNotExposeAnonymousActions()
    {
        var assembly = typeof(LocalAuthController).Assembly;
        var offenders = new List<string>();

        foreach (var controller in assembly.GetTypes()
                     .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && t.Name.EndsWith("Controller")))
        {
            if (LegacySessionControllers.Contains(controller.Name)) continue;
            var classAuthorize = controller.GetCustomAttributes<AuthorizeAttribute>(true).Any();

            foreach (var method in controller.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
                         .Where(m => !m.IsSpecialName))
            {
                var isAction = method.GetCustomAttributes<HttpMethodAttribute>(true).Any();
                if (!isAction) continue;

                var allowAnonymous = method.GetCustomAttributes<AllowAnonymousAttribute>(true).Any();
                var methodAuthorize = method.GetCustomAttributes<AuthorizeAttribute>(true).Any();
                if (!classAuthorize && !methodAuthorize && !allowAnonymous)
                    offenders.Add($"{controller.Name}.{method.Name}");
            }
        }

        // LocalAuthController.Login is intentionally anonymous; all other canonical API actions must be secured.
        offenders.RemoveAll(x => x == $"{nameof(LocalAuthController)}.Login");
        Assert.True(offenders.Count == 0, "Unsecured canonical actions: " + string.Join(", ", offenders));
    }

    [Fact]
    public void AdminControllers_RequireAdminRole()
    {
        var assembly = typeof(AdminUsersController).Assembly;
        var adminControllers = assembly.GetTypes()
            .Where(t => t.Name.StartsWith("Admin") && t.Name.EndsWith("Controller"));

        foreach (var controller in adminControllers)
        {
            var authorize = controller.GetCustomAttributes<AuthorizeAttribute>(true).FirstOrDefault();
            Assert.NotNull(authorize);
            Assert.Contains(UserRoles.Admin, authorize!.Roles ?? string.Empty);
        }
    }
}
