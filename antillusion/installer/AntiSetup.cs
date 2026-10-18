// Antillusion Setup window: a custom-drawn terminal-style window (GDI+), animated with a timer.
// C# 5 syntax on purpose: Windows PowerShell 5.1 compiles it with the .NET Framework compiler.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows.Forms;

public class AntiSetupWindow : Form
{
    const int W = 640, H = 420;
    static readonly Color Coral = Color.FromArgb(224, 122, 86), CoralDark = Color.FromArgb(110, 58, 41), CoralLight = Color.FromArgb(255, 188, 150);
    static readonly Color Bg = Color.FromArgb(25, 25, 28), Panel = Color.FromArgb(19, 19, 22), Edge = Color.FromArgb(52, 52, 58);
    static readonly Color Dim = Color.FromArgb(138, 138, 148), Txt = Color.FromArgb(232, 232, 237);
    static readonly Color Green = Color.FromArgb(80, 205, 125), Red = Color.FromArgb(240, 98, 98);
    static readonly Dictionary<char, string[]> Glyph = new Dictionary<char, string[]>();

    readonly object sync = new object();
    string status = "Starting", failMessage = "", statusKey = "";
    double statusSince, target, disp;
    bool done, ok;
    double doneAt = -1;
    readonly List<string> logs = new List<string>();
    readonly List<double> logAt = new List<double>();
    double clock;
    readonly Stopwatch watch = new Stopwatch();
    double lastReal;
    readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
    Font mono, monoBold, monoSmall, ui, uiBold, tiny;
    public bool Cancelled;
    public bool Success { get { return done && ok; } }

    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int msg, int w, int l);

    static AntiSetupWindow()
    {
        Glyph['A'] = new[] { " ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #" };
        Glyph['N'] = new[] { "#   #", "##  #", "# # #", "#  ##", "#   #", "#   #", "#   #" };
        Glyph['T'] = new[] { "#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  " };
        Glyph['I'] = new[] { " ### ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", " ### " };
        Glyph['L'] = new[] { "#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####" };
        Glyph['U'] = new[] { "#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### " };
        Glyph['S'] = new[] { " ####", "#    ", "#    ", " ### ", "    #", "    #", "#### " };
        Glyph['O'] = new[] { " ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### " };
    }

    public AntiSetupWindow()
    {
        Text = "Antillusion Setup";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(W, H);
        BackColor = Color.Black;
        DoubleBuffered = true;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
        mono = new Font("Consolas", 10.5f); monoBold = new Font("Consolas", 11f, FontStyle.Bold); monoSmall = new Font("Consolas", 9f);
        ui = new Font("Segoe UI", 12.5f); uiBold = new Font("Segoe UI Semibold", 12.5f); tiny = new Font("Segoe UI", 8.5f);
        GraphicsPath gp = Round(new RectangleF(0, 0, W, H), 16); Region = new Region(gp);
        timer.Interval = 16; timer.Tick += delegate { RealStep(); Invalidate(); };
        watch.Start();
        timer.Start();
    }

    // ---------- thread-safe API used by the install worker ----------
    public void SetStatus(string text)
    {
        lock (sync)
        {
            string key = Regex.Replace(text ?? "", "[0-9]+", "#");
            if (key != statusKey) { statusKey = key; statusSince = clock; }
            status = text ?? "";
        }
    }
    public void SetProgress(double pct) { lock (sync) { target = Math.Max(0, Math.Min(100, pct)) / 100.0; } }
    public void AddLog(string line) { lock (sync) { logs.Add(line ?? ""); logAt.Add(clock); if (logs.Count > 40) { logs.RemoveAt(0); logAt.RemoveAt(0); } } }
    public void Complete(bool success, string message)
    {
        lock (sync) { done = true; ok = success; failMessage = message ?? ""; doneAt = clock; if (success) target = 1; }
    }

    // ---------- time ----------
    void RealStep() { double now = watch.Elapsed.TotalSeconds; double dt = Math.Min(0.1, now - lastReal); lastReal = now; Step(dt); }
    public void Step(double dt)
    {
        lock (sync)
        {
            clock += dt;
            disp += (target - disp) * (1 - Math.Exp(-dt * 5));
            if (done && ok && clock > doneAt + 1.7)
            {
                Opacity = Math.Max(0, Opacity - dt * 2.5);
                if (Opacity <= 0.02) { timer.Stop(); Close(); }
            }
        }
    }
    public void Simulate(double seconds) { for (double t = 0; t < seconds; t += 1.0 / 30) Step(1.0 / 30); }

    // ---------- window behaviour ----------
    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;
        if (e.Y < 40)
        {
            if (Math.Abs(e.X - 22) < 9 && Math.Abs(e.Y - 20) < 9) { Cancelled = true; Close(); return; }
            if (Math.Abs(e.X - 42) < 9 && Math.Abs(e.Y - 20) < 9) { WindowState = FormWindowState.Minimized; return; }
            ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0);
        }
    }
    protected override void OnPaint(PaintEventArgs e) { lock (sync) { Draw(e.Graphics); } }

    public void SaveFrame(string path)
    {
        using (Bitmap bmp = new Bitmap(W, H))
        using (Graphics g = Graphics.FromImage(bmp)) { lock (sync) { Draw(g); } bmp.Save(path, ImageFormat.Png); }
    }

    // ---------- drawing ----------
    static GraphicsPath Round(RectangleF r, float rad)
    {
        GraphicsPath p = new GraphicsPath(); float d = rad * 2;
        p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90); p.CloseFigure(); return p;
    }
    static Color Lerp(Color a, Color b, double t)
    {
        t = Math.Max(0, Math.Min(1, t));
        return Color.FromArgb((int)(a.R + (b.R - a.R) * t), (int)(a.G + (b.G - a.G) * t), (int)(a.B + (b.B - a.B) * t));
    }
    static double Hash(int n) { unchecked { uint x = (uint)(n * 374761393 + 668265263); x = (x ^ (x >> 13)) * 1274126177; x ^= x >> 16; return (x & 0xFFFFFF) / (double)0x1000000; } }

    void Draw(Graphics g)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        g.PixelOffsetMode = PixelOffsetMode.Half;
        g.Clear(Color.Black);
        Color accent = failMessage.Length > 0 && done && !ok ? Red : (done && ok ? Green : Coral);

        using (GraphicsPath win = Round(new RectangleF(0, 0, W - 1, H - 1), 16))
        {
            using (SolidBrush b = new SolidBrush(Bg)) g.FillPath(b, win);
            // drifting pixels
            for (int i = 0; i < 30; i++)
            {
                double sp = 10 + Hash(i * 7) * 22, off = Hash(i * 13) * (H + 40);
                float y = (float)(H + 10 - ((clock * sp + off) % (H + 40)));
                float x = (float)(Hash(i * 31) * W); int a = (int)(18 + Hash(i * 5) * 46); float s = 2 + (float)Math.Floor(Hash(i * 3) * 3);
                using (SolidBrush b = new SolidBrush(Color.FromArgb(a, accent))) g.FillRectangle(b, (float)Math.Round(x), (float)Math.Round(y), s, s);
            }
            // title bar
            using (SolidBrush b = new SolidBrush(Color.FromArgb(235, Bar()))) { g.SetClip(new RectangleF(0, 0, W, 40)); g.FillPath(b, win); g.ResetClip(); }
            using (Pen p = new Pen(Edge)) g.DrawLine(p, 0, 40, W, 40);
            Dot(g, 22, Color.FromArgb(255, 95, 87)); Dot(g, 42, Color.FromArgb(254, 188, 46)); Dot(g, 62, Color.FromArgb(40, 200, 64));
            using (SolidBrush b = new SolidBrush(Dim)) g.DrawString("antillusion — setup", monoSmall, b, new RectangleF(0, 12, W, 20), new StringFormat { Alignment = StringAlignment.Center });

            DrawChip(g, accent);
            DrawTitle(g, accent);
            using (SolidBrush b = new SolidBrush(Dim)) g.DrawString("AI coding agent  ·  downloads everything it needs, installs for you only", monoSmall, b, 38, 198);
            DrawLog(g, accent);
            DrawBar(g, accent);
            DrawStatus(g, accent);
            using (SolidBrush b = new SolidBrush(Color.FromArgb(110, 110, 120))) g.DrawString("No administrator rights needed  ·  log: %TEMP%\\antillusion-setup.log", tiny, b, 38, 394);
            using (Pen p = new Pen(Color.FromArgb(done ? 255 : 150, accent), 1.5f)) g.DrawPath(p, win);
        }
    }
    static Color Bar() { return Color.FromArgb(32, 32, 36); }
    static void Dot(Graphics g, float x, Color c) { using (SolidBrush b = new SolidBrush(c)) g.FillEllipse(b, x - 6, 14, 12, 12); }

    void DrawChip(Graphics g, Color accent)
    {
        RectangleF r = new RectangleF(36, 58, 340, 46);
        using (GraphicsPath p = Round(r, 11))
        {
            using (SolidBrush b = new SolidBrush(Panel)) g.FillPath(b, p);
            using (Pen pen = new Pen(accent, 2f)) g.DrawPath(pen, p);
        }
        float cx = 62, cy = 81, rad = 12;
        if (done && ok)
        {
            double k = Math.Min(1, (clock - doneAt) * 4); float s = (float)(1 + 0.35 * Math.Sin(k * Math.PI));
            using (Pen pen = new Pen(Green, 3f * s) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
                g.DrawLines(pen, new[] { new PointF(cx - 8 * s, cy + 1 * s), new PointF(cx - 2 * s, cy + 7 * s), new PointF(cx + 9 * s, cy - 7 * s) });
        }
        else if (done)
        {
            using (Pen pen = new Pen(Red, 3f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
            { g.DrawLine(pen, cx - 7, cy - 7, cx + 7, cy + 7); g.DrawLine(pen, cx + 7, cy - 7, cx - 7, cy + 7); }
        }
        else
        {
            float angle = (float)(clock * 150);
            using (Pen pen = new Pen(accent, 2.2f)) g.DrawEllipse(pen, cx - rad, cy - rad, rad * 2, rad * 2);
            using (SolidBrush b = new SolidBrush(accent)) g.FillPie(b, cx - rad, cy - rad, rad * 2, rad * 2, angle, 180);
        }
        string label = done ? (ok ? "All set — launching Antillusion" : "Setup failed") : "Installing Antillusion";
        using (SolidBrush b = new SolidBrush(Txt)) g.DrawString(label, uiBold, b, 88, 69);
    }

    void DrawTitle(Graphics g, Color accent)
    {
        string word = "ANTILLUSION"; const int cell = 7; const int ox = 40, oy = 126;
        int cols = word.Length * 5 + (word.Length - 1), reveal = (int)(Math.Max(0, Math.Min(1, (clock - 0.15) / 1.5)) * cols) + 1;
        double band = (clock * 14) % (cols + 40) - 12;
        for (int pass = 0; pass < 2; pass++)   // pass 0 draws the stacked shadow, pass 1 the letters
        {
            int x0 = 0;
            for (int li = 0; li < word.Length; li++, x0 += 6)
            {
                string[] gl = Glyph[word[li]];
                for (int r = 0; r < 7; r++) for (int c = 0; c < 5; c++)
                {
                    if (gl[r][c] != '#') continue;
                    int col = x0 + c; if (col >= reveal) continue;
                    Color color;
                    if (pass == 0) color = CoralDark;
                    else
                    {
                        double front = reveal - col;
                        color = Lerp(accent, CoralLight, Math.Max(0, 1 - Math.Abs(col - band) / 5.0) * 0.9);
                        if (front < 4 && reveal < cols) color = Lerp(color, Color.White, 0.8 - front * 0.2);
                        if (done && ok) color = Lerp(color, Color.White, 0.25 * (0.5 + 0.5 * Math.Sin((clock - doneAt) * 8 - col * 0.3)));
                        if (front < 4 && Hash(col * 17 + r * 3 + (int)(clock * 20)) < 0.35) continue;   // flicker while it builds
                    }
                    int dx = pass == 0 ? 3 : 0, dy = pass == 0 ? 3 : 0;
                    using (SolidBrush b = new SolidBrush(color)) g.FillRectangle(b, ox + col * cell + dx, oy + r * cell + dy, cell - 1, cell - 1);
                }
            }
        }
    }

    void DrawLog(Graphics g, Color accent)
    {
        RectangleF box = new RectangleF(36, 222, 568, 96);
        using (GraphicsPath p = Round(box, 9))
        {
            using (SolidBrush b = new SolidBrush(Panel)) g.FillPath(b, p);
            using (Pen pen = new Pen(Edge)) g.DrawPath(pen, p);
        }
        int n = logs.Count, first = Math.Max(0, n - 4);
        for (int i = first; i < n; i++)
        {
            int rank = n - 1 - i; float y = 231 + (i - first) * 20 + (n < 4 ? 0 : 0);
            double age = clock - logAt[i];
            int shown = rank == 0 ? (int)Math.Min(logs[i].Length, age * 80) : logs[i].Length;
            double fade = Math.Min(1, age * 5);
            int alpha = (int)(255 * fade * (rank == 0 ? 1.0 : (rank == 1 ? 0.7 : (rank == 2 ? 0.5 : 0.35))));
            using (SolidBrush b1 = new SolidBrush(Color.FromArgb(alpha, accent))) g.DrawString("$", mono, b1, 46, y);
            using (SolidBrush b2 = new SolidBrush(Color.FromArgb(alpha, rank == 0 ? Txt : Dim))) g.DrawString(logs[i].Substring(0, shown), mono, b2, 64, y);
        }
        if (n == 0) using (SolidBrush b = new SolidBrush(Dim)) g.DrawString("waiting for the first step...", mono, b, 64, 231);
    }

    void DrawBar(Graphics g, Color accent)
    {
        const int segs = 40; float x0 = 38, y0 = 334, w = 500, h = 14, gap = 3, sw = (w - gap * (segs - 1)) / segs;
        double filled = disp * segs; int hi = (int)((clock * 22) % (segs + 14)) - 7;
        for (int i = 0; i < segs; i++)
        {
            float x = x0 + i * (sw + gap); double f = Math.Max(0, Math.Min(1, filled - i));
            using (SolidBrush b = new SolidBrush(Color.FromArgb(42, 42, 48))) g.FillRectangle(b, x, y0, sw, h);
            if (f > 0)
            {
                Color c = Lerp(accent, CoralLight, Math.Max(0, 1 - Math.Abs(i - hi) / 4.0) * (done ? 0 : 0.85));
                using (SolidBrush b = new SolidBrush(Color.FromArgb((int)(255 * (0.35 + 0.65 * f)), c))) g.FillRectangle(b, x, y0, sw, h);
            }
        }
        using (SolidBrush b = new SolidBrush(Txt)) g.DrawString(((int)Math.Round(disp * 100)).ToString() + "%", monoBold, b, new RectangleF(540, 331, 64, 20), new StringFormat { Alignment = StringAlignment.Far });
    }

    void DrawStatus(Graphics g, Color accent)
    {
        if (done && !ok)
        {
            using (SolidBrush b = new SolidBrush(Red)) g.DrawString(failMessage, mono, b, new RectangleF(38, 358, 566, 40));
            return;
        }
        string text = status; int shown = (int)Math.Min(text.Length, (clock - statusSince) * 60);
        string part = text.Substring(0, Math.Max(0, shown));
        using (SolidBrush b = new SolidBrush(Txt)) g.DrawString(part, mono, b, 38, 358);
        float wpx = g.MeasureString(part, mono, 2000, StringFormat.GenericTypographic).Width;
        if (((int)(clock * 2)) % 2 == 0 && !done) using (SolidBrush b = new SolidBrush(accent)) g.FillRectangle(b, 40 + wpx, 360, 8, 15);
    }
}
