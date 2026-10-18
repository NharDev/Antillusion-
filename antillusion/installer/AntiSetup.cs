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
    static readonly Color Coral = Color.FromArgb(124, 156, 255), CoralDark = Color.FromArgb(40, 52, 104), CoralLight = Color.FromArgb(200, 214, 255);   // Antillusion accent (#7c9cff) and its shades
    static readonly Color Bg = Color.FromArgb(18, 19, 22), Panel = Color.FromArgb(14, 15, 17), Edge = Color.FromArgb(44, 46, 54);   // Antillusion dark theme
    static readonly Color Dim = Color.FromArgb(111, 116, 126), Txt = Color.FromArgb(228, 229, 233);
    static readonly Color Green = Color.FromArgb(80, 205, 125), Red = Color.FromArgb(240, 98, 98);
    static readonly Dictionary<char, string[]> Glyph = new Dictionary<char, string[]>();

    static readonly StringFormat Clip = new StringFormat(StringFormat.GenericDefault) { Trimming = StringTrimming.EllipsisCharacter, FormatFlags = StringFormatFlags.NoWrap | StringFormatFlags.LineLimit };
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
    int hover = -1;                 // window-control under the mouse: 0 minimize, 1 maximize, 2 close
    bool maximized;
    float scale = 1f, offX, offY;   // the design is W x H; the window can be maximized and everything scales with it
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
            if (!(done && ok && clock > doneAt + 1.7)) Opacity = Math.Min(1.0, clock / 0.35);   // window fades in
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
    PointF ToDesign(int x, int y) { return new PointF((x - offX) / scale, (y - offY) / scale); }
    static int ControlAt(PointF p)
    {
        if (p.Y < 0 || p.Y >= 40) return -1;
        if (p.X >= W - 46) return 2; if (p.X >= W - 92) return 1; if (p.X >= W - 138) return 0; return -1;
    }
    protected override void OnMouseMove(MouseEventArgs e) { int h = ControlAt(ToDesign(e.X, e.Y)); if (h != hover) { hover = h; Cursor = h >= 0 ? Cursors.Hand : Cursors.Default; Invalidate(); } }
    protected override void OnMouseLeave(EventArgs e) { if (hover != -1) { hover = -1; Invalidate(); } }
    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;
        PointF p = ToDesign(e.X, e.Y);
        if (p.Y >= 0 && p.Y < 40)
        {
            int c = ControlAt(p);
            if (c == 2) { Cancelled = true; Close(); return; }
            if (c == 1) { ToggleMaximize(); return; }
            if (c == 0) { WindowState = FormWindowState.Minimized; return; }
            if (!maximized) { ReleaseCapture(); SendMessage(Handle, 0xA1, 2, 0); }
        }
    }
    protected override void OnMouseDoubleClick(MouseEventArgs e) { PointF p = ToDesign(e.X, e.Y); if (p.Y >= 0 && p.Y < 40 && ControlAt(p) < 0) ToggleMaximize(); }
    void ToggleMaximize()
    {
        if (maximized) { maximized = false; WindowState = FormWindowState.Normal; ClientSize = new Size(W, H); Region = new Region(Round(new RectangleF(0, 0, W, H), 16)); }
        else { maximized = true; MaximizedBounds = Screen.FromControl(this).WorkingArea; Region = null; WindowState = FormWindowState.Maximized; }
        Invalidate();
    }
    protected override void OnResize(EventArgs e) { base.OnResize(e); Invalidate(); }

    protected override void OnPaint(PaintEventArgs e)
    {
        Graphics g = e.Graphics; int cw = ClientSize.Width, ch = ClientSize.Height;
        scale = Math.Min(cw / (float)W, ch / (float)H); if (scale <= 0) scale = 1;
        offX = (cw - W * scale) / 2f; offY = (ch - H * scale) / 2f;
        g.Clear(maximized ? Bg : Color.Black);   // letterbox colour matches the window; black corners are cut off by the window Region
        g.TranslateTransform(offX, offY); g.ScaleTransform(scale, scale);
        lock (sync) { Draw(g); }
    }

    public void SaveFrame(string path)
    {
        using (Bitmap bmp = new Bitmap(W, H))
        using (Graphics g = Graphics.FromImage(bmp)) { scale = 1f; offX = 0; offY = 0; g.Clear(Color.Black); lock (sync) { Draw(g); } bmp.Save(path, ImageFormat.Png); }
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
        Color accent = failMessage.Length > 0 && done && !ok ? Red : (done && ok ? Green : Coral);

        using (GraphicsPath win = Round(new RectangleF(0, 0, W - 1, H - 1), maximized ? 0.5f : 16))
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
            DrawMiniMark(g, 18, 20, accent);
            using (SolidBrush b = new SolidBrush(Dim)) g.DrawString("antillusion \u2014 setup", monoSmall, b, 34, 12);
            DrawControls(g);

            DrawChip(g, accent);
            DrawTitle(g, accent);
            using (SolidBrush b = new SolidBrush(Dim)) g.DrawString("AI coding agent  \u00b7  downloads everything it needs, installs for you only", monoSmall, b, 38, 198);
            DrawLog(g, accent);
            DrawBar(g, accent);
            DrawStatus(g, accent);
            using (SolidBrush b = new SolidBrush(Color.FromArgb(110, 110, 120))) g.DrawString("No administrator rights needed  \u00b7  log: %TEMP%\\antillusion-setup.log", tiny, b, 38, 394);
            using (Pen p = new Pen(Color.FromArgb(done ? 255 : 150, accent), 1.5f)) g.DrawPath(p, win);
        }
    }
    static Color Bar() { return Color.FromArgb(32, 32, 36); }
    static readonly string[][] Icons = new string[][] {
        new[] { "       ", "       ", "       ", "       ", "       ", "#######", "       " },                       // minimize
        new[] { "#######", "#     #", "#     #", "#     #", "#     #", "#     #", "#######" },                        // maximize
        new[] { "#######", "#     #", "# ### #", "# ### #", "# ### #", "#     #", "#######" },                        // restore
        new[] { "#     #", " #   # ", "  # #  ", "   #   ", "  # #  ", " #   # ", "#     #" } };                      // close
    void DrawControls(Graphics g)
    {
        for (int i = 0; i < 3; i++)
        {
            float x0 = W - 46 * (3 - i); bool hot = hover == i;
            if (hot) using (SolidBrush b = new SolidBrush(i == 2 ? Color.FromArgb(200, Red) : Color.FromArgb(34, 255, 255, 255))) g.FillRectangle(b, x0, 0, 46, 40);
            string[] icon = Icons[i == 1 && maximized ? 2 : (i == 2 ? 3 : i)];
            Color c = hot ? Color.White : Dim; float px = x0 + 23 - 10.5f, py = 20 - 10.5f;   // 7 cells of 2px with a 1px gap = 21px
            using (SolidBrush b = new SolidBrush(c))
                for (int r = 0; r < 7; r++) for (int col = 0; col < 7; col++) if (icon[r][col] == '#') g.FillRectangle(b, px + col * 3, py + r * 3, 2, 2);
        }
    }
    void DrawMiniMark(Graphics g, float cx, float cy, Color accent)
    {
        using (Pen pen = new Pen(accent, 1.6f)) g.DrawEllipse(pen, cx - 6, cy - 6, 12, 12);
        using (SolidBrush b = new SolidBrush(accent)) g.FillPie(b, cx - 6, cy - 6, 12, 12, (float)(clock * 150), 180);
    }

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
        string label = done ? (ok ? "All set \u2014 launching Antillusion" : "Setup failed") : "Installing Antillusion";
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
            using (SolidBrush b2 = new SolidBrush(Color.FromArgb(alpha, rank == 0 ? Txt : Dim))) g.DrawString(logs[i].Substring(0, shown), mono, b2, new RectangleF(64, y, 528, 20), Clip);
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
            using (SolidBrush b = new SolidBrush(Red)) g.DrawString(failMessage, mono, b, new RectangleF(38, 356, 566, 34), new StringFormat(StringFormat.GenericDefault) { Trimming = StringTrimming.EllipsisWord, FormatFlags = StringFormatFlags.LineLimit });
            return;
        }
        string text = status; int shown = (int)Math.Min(text.Length, (clock - statusSince) * 60);
        string part = text.Substring(0, Math.Max(0, shown));
        using (SolidBrush b = new SolidBrush(Txt)) g.DrawString(part, mono, b, new RectangleF(38, 358, 566, 20), Clip);
        float wpx = Math.Min(540f, g.MeasureString(part, mono, 2000, StringFormat.GenericTypographic).Width);
        if (((int)(clock * 2)) % 2 == 0 && !done) using (SolidBrush b = new SolidBrush(accent)) g.FillRectangle(b, 40 + wpx, 360, 8, 15);
    }
}
