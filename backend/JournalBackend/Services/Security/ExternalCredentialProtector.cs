using Microsoft.AspNetCore.DataProtection;

namespace JournalBackend.Services.Security;

public interface IExternalCredentialProtector
{
    string Protect(string plaintext);
    string? Unprotect(string? storedValue);
    bool IsProtected(string? storedValue);
}

public sealed class ExternalCredentialProtector : IExternalCredentialProtector
{
    private const string Prefix = "enc:v1:";
    private readonly IDataProtector _protector;

    public ExternalCredentialProtector(IDataProtectionProvider provider)
    {
        _protector = provider.CreateProtector("Jornal.ExternalCredentials.v1");
    }

    public string Protect(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext))
            return plaintext;
        if (IsProtected(plaintext))
            return plaintext;
        return Prefix + _protector.Protect(plaintext);
    }

    public string? Unprotect(string? storedValue)
    {
        if (string.IsNullOrEmpty(storedValue))
            return storedValue;
        if (!IsProtected(storedValue))
            throw new InvalidOperationException("External credential is not encrypted; database migration is required before use.");

        return _protector.Unprotect(storedValue[Prefix.Length..]);
    }

    public bool IsProtected(string? storedValue) =>
        !string.IsNullOrEmpty(storedValue) && storedValue.StartsWith(Prefix, StringComparison.Ordinal);
}
