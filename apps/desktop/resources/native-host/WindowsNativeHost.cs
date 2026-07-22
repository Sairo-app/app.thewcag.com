using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace TheWCAG.NativeMessaging
{
    internal static class Program
    {
        private const int O_BINARY = 0x8000;
        private const int MaxRequestBytes = 14 * 1024 * 1024;
        private const int MaxResponseBytes = 1024 * 1024;
        private const int ConnectTimeoutMilliseconds = 15000;
        private const int ResponseTimeoutMilliseconds = 60000;

        private static readonly Regex ExtensionOrigin = new Regex(
            "^chrome-extension://[a-p]{32}/$",
            RegexOptions.CultureInvariant
        );

        private static readonly Regex RequestId = new Regex(
            "\\\"requestId\\\"\\s*:\\s*\\\"([A-Za-z0-9_-]{1,64})\\\"",
            RegexOptions.CultureInvariant
        );

        [DllImport("msvcrt.dll", CallingConvention = CallingConvention.Cdecl)]
        private static extern int _setmode(int fileDescriptor, int mode);

        public static int Main(string[] args)
        {
            _setmode(0, O_BINARY);
            _setmode(1, O_BINARY);

            Stream output = Console.OpenStandardOutput();
            byte[] request = null;
            try
            {
                request = ReadFrame(Console.OpenStandardInput(), MaxRequestBytes);
                RelayToDesktop(args, request, output);
                return 0;
            }
            catch (Exception error)
            {
                WriteDebug(error);
                try
                {
                    WriteError(output, ExtractRequestId(request), FriendlyMessage(error));
                }
                catch
                {
                    // Chrome will report a broken host if even the bounded error cannot be written.
                }
                return 1;
            }
        }

        private static void RelayToDesktop(string[] args, byte[] request, Stream output)
        {
            string origin = FindOrigin(args);
            if (origin == null)
            {
                throw new InvalidOperationException("Chrome did not provide a valid extension origin.");
            }

            string desktopPath = Path.GetFullPath(Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "..",
                "..",
                "TheWCAG.exe"
            ));
            if (!File.Exists(desktopPath))
            {
                throw new FileNotFoundException("TheWCAG desktop executable was not found.", desktopPath);
            }

            string pipeName = "TheWCAG.NativeMessaging." + Guid.NewGuid().ToString("N");
            using (NamedPipeServerStream pipe = new NamedPipeServerStream(
                pipeName,
                PipeDirection.InOut,
                1,
                PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous,
                MaxResponseBytes,
                MaxRequestBytes
            ))
            using (Process desktop = new Process())
            {
                bool debug = DebugEnabled();
                IAsyncResult connection = pipe.BeginWaitForConnection(null, null);
                desktop.StartInfo = new ProcessStartInfo
                {
                    FileName = desktopPath,
                    Arguments = origin + " --thewcag-native-pipe=" + pipeName,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                };
                desktop.OutputDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
                {
                    if (debug && eventArgs.Data != null) Console.Error.WriteLine("[desktop stdout] " + eventArgs.Data);
                };
                desktop.ErrorDataReceived += delegate(object sender, DataReceivedEventArgs eventArgs)
                {
                    if (debug && eventArgs.Data != null) Console.Error.WriteLine("[desktop stderr] " + eventArgs.Data);
                };

                if (!desktop.Start())
                {
                    throw new InvalidOperationException("TheWCAG desktop connector could not start.");
                }
                desktop.BeginOutputReadLine();
                desktop.BeginErrorReadLine();
                desktop.StandardInput.Close();

                if (!connection.AsyncWaitHandle.WaitOne(ConnectTimeoutMilliseconds))
                {
                    throw new TimeoutException("TheWCAG desktop connector did not become ready in time.");
                }
                pipe.EndWaitForConnection(connection);

                WriteFrame(pipe, request);
                Task<byte[]> responseTask = Task.Factory.StartNew(
                    delegate { return ReadFrame(pipe, MaxResponseBytes); }
                );
                if (!responseTask.Wait(ResponseTimeoutMilliseconds))
                {
                    throw new TimeoutException("TheWCAG desktop connector did not respond in time.");
                }
                WriteFrame(output, responseTask.Result);

                desktop.WaitForExit(5000);
                TryDeleteRuntimeDirectory(pipeName);
            }
        }

        private static byte[] ReadFrame(Stream stream, int maximumBytes)
        {
            byte[] header = ReadExactly(stream, 4);
            uint length = BitConverter.ToUInt32(header, 0);
            if (length < 2 || length > maximumBytes)
            {
                throw new InvalidDataException("The native message is outside the allowed size.");
            }
            return ReadExactly(stream, checked((int)length));
        }

        private static byte[] ReadExactly(Stream stream, int length)
        {
            byte[] buffer = new byte[length];
            int offset = 0;
            while (offset < length)
            {
                int count = stream.Read(buffer, offset, length - offset);
                if (count == 0)
                {
                    throw new EndOfStreamException("The native messaging stream closed before a complete message arrived.");
                }
                offset += count;
            }
            return buffer;
        }

        private static void WriteFrame(Stream stream, byte[] body)
        {
            byte[] header = BitConverter.GetBytes((uint)body.Length);
            stream.Write(header, 0, header.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        private static string FindOrigin(string[] args)
        {
            foreach (string value in args)
            {
                if (ExtensionOrigin.IsMatch(value)) return value;
            }
            return null;
        }

        private static string ExtractRequestId(byte[] request)
        {
            if (request != null)
            {
                Match match = RequestId.Match(Encoding.UTF8.GetString(request));
                if (match.Success) return match.Groups[1].Value;
            }
            return Guid.NewGuid().ToString();
        }

        private static string FriendlyMessage(Exception error)
        {
            error = RootError(error);
            if (error is TimeoutException) return error.Message;
            if (error is FileNotFoundException) return "TheWCAG desktop is not installed correctly.";
            return "TheWCAG desktop connector could not complete the request.";
        }

        private static Exception RootError(Exception error)
        {
            AggregateException aggregate = error as AggregateException;
            if (aggregate != null)
            {
                aggregate = aggregate.Flatten();
                if (aggregate.InnerExceptions.Count == 1) return RootError(aggregate.InnerExceptions[0]);
            }
            return error;
        }

        private static void WriteDebug(Exception error)
        {
            if (!DebugEnabled()) return;
            Console.Error.WriteLine(RootError(error).ToString());
        }

        private static bool DebugEnabled()
        {
            return string.Equals(
                Environment.GetEnvironmentVariable("THEWCAG_NATIVE_HOST_DEBUG"),
                "1",
                StringComparison.Ordinal
            );
        }

        private static void WriteError(Stream output, string requestId, string message)
        {
            string json = "{\"protocolVersion\":1,\"requestId\":\"" + EscapeJson(requestId)
                + "\",\"ok\":false,\"type\":\"error\",\"code\":\"desktop-unavailable\",\"message\":\""
                + EscapeJson(message) + "\",\"retryable\":true}";
            WriteFrame(output, Encoding.UTF8.GetBytes(json));
        }

        private static string EscapeJson(string value)
        {
            return value
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"")
                .Replace("\r", "\\r")
                .Replace("\n", "\\n");
        }

        private static void TryDeleteRuntimeDirectory(string pipeName)
        {
            try
            {
                string runtime = Path.Combine(
                    Path.GetTempPath(),
                    "TheWCAG",
                    "native-host",
                    pipeName
                );
                if (Directory.Exists(runtime)) Directory.Delete(runtime, true);
            }
            catch
            {
                // Windows can retain Chromium cache handles briefly; the OS temp cleaner is the fallback.
            }
        }
    }
}
