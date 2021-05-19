using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using System.IO;
using System.Reflection;
using ICSharpCode.SharpZipLib.Zip;
using System.Threading.Tasks;

namespace XiePinyin.Logic
{
    internal class DocxExporter
    {
        readonly string skDocument;
        readonly string skPara;
        readonly string skRubyWord;
        readonly string skText;
        readonly string skStyles;

        readonly Composer composer;
        readonly XieChar[] text;
        readonly string fname;

        string readStringResource(string fn)
        {
            var ass = Assembly.GetExecutingAssembly();
            using (Stream s = ass.GetManifestResourceStream("XiePinyin.Resources." + fn))
            using (StreamReader rdr = new StreamReader(s))
            {
                return rdr.ReadToEnd();
            }
        }

        public DocxExporter(Composer composer, XieChar[] text, string fname)
        {
            skDocument = readStringResource("skeleton-document.xml");
            skPara = readStringResource("skeleton-paragraph.xml");
            skRubyWord = readStringResource("skeleton-rubyword.xml");
            skText = readStringResource("skeleton-text.xml");
            skStyles = readStringResource("styles.xml");

            this.composer = composer;
            this.text = text;
            this.fname = fname;
        }

        public static void Housekeep(string folder)
        {
            // TO-DO: Have document juggler call this
            // Delete old files
            // Export file name
        }

        public class CustomStaticDataSource : IStaticDataSource
        {
            private Stream _stream;
            public Stream GetSource()
            {
                return _stream;
            }

            public void SetStream(Stream inputStream)
            {
                _stream = inputStream;
                _stream.Position = 0;
            }
        }

        void makeZip(string fn, string docXml)
        {
            var ass = Assembly.GetExecutingAssembly();
            using (Stream temaplateStream = ass.GetManifestResourceStream("XiePinyin.Resources.template.docx"))
            {
                byte[] ba = new byte[temaplateStream.Length];
                temaplateStream.Read(ba, 0, ba.Length);
                File.WriteAllBytes(fn, ba);
            }
            using (Stream zipStream = new FileStream(fn, FileMode.Open, FileAccess.ReadWrite))
            {
                ZipFile zipFile = new ZipFile(zipStream);
                zipFile.BeginUpdate();
                CustomStaticDataSource sds;
                // Update document.xml
                sds = new CustomStaticDataSource();
                sds.SetStream(new MemoryStream(Encoding.UTF8.GetBytes(docXml)));
                zipFile.Add(sds, "word/document.xml");
                // Update styles.xm
                sds = new CustomStaticDataSource();
                sds.SetStream(new MemoryStream(Encoding.UTF8.GetBytes(skStyles)));
                zipFile.Add(sds, "word/styles.xml");
                // Finish
                zipFile.CommitUpdate();
                zipFile.Close();
            }
        }

        static string esc(string str)
        {
            str = str.Replace("&", "&amp;");
            str = str.Replace("<", "&lt;");
            str = str.Replace(">", "&gt;");
            return str;
        }

        class BiWord
        {
            public string Hanzi = "";
            public string Pinyin = "";
            public bool IsEmpty { get { return Hanzi == "" && Pinyin == ""; } }
        }

        readonly Regex reWS = new Regex(@"^\s+$");

        List<BiWord> makeWords(List<XieChar> para)
        {
            var res = new List<BiWord>();
            if (para.Count == 0) return res;

            bool inAlfa = string.IsNullOrEmpty(para[0].Pinyin);
            int ix = 0;
            var word = new BiWord();
            while (ix < para.Count)
            {
                // First, eat up leading WS
                while (ix < para.Count && reWS.IsMatch(para[ix].Hanzi))
                {
                    if (inAlfa && para[ix].Pinyin != null || !inAlfa && para[ix].Pinyin == null)
                        goto WordOver;
                    word.Pinyin += " ";
                    ++ix;
                }
                if (!word.IsEmpty)
                {
                    res.Add(word);
                    word = new BiWord();
                }
                // Eat up words: non-WS followed by WS
                while (ix < para.Count)
                {
                    while (ix < para.Count && !reWS.IsMatch(para[ix].Hanzi))
                    {
                        if (inAlfa && !string.IsNullOrEmpty(para[ix].Pinyin) || !inAlfa && string.IsNullOrEmpty(para[ix].Pinyin))
                            goto WordOver;
                        if (!inAlfa)
                        {
                            if (!string.IsNullOrEmpty(para[ix].Hanzi)) word.Hanzi += para[ix].Hanzi;
                            if (!string.IsNullOrEmpty(para[ix].Pinyin)) word.Pinyin += para[ix].Pinyin;
                        }
                        else word.Pinyin += para[ix].Hanzi;
                        ++ix;
                    }
                    while (ix < para.Count && reWS.IsMatch(para[ix].Hanzi))
                    {
                        if (inAlfa && para[ix].Pinyin != null || !inAlfa && para[ix].Pinyin == null)
                            goto WordOver;
                        word.Pinyin += " ";
                        ++ix;
                    }
                    res.Add(word);
                    word = new BiWord();
                }

            WordOver:
                if (!word.IsEmpty) res.Add(word);
                word = new BiWord();
                inAlfa = !inAlfa;
            }

            // Convert Pinyin in biscriptal words to pretty accents
            foreach (var x in res)
            {
                if (x.Pinyin == "" || x.Hanzi == "") continue;
                x.Pinyin = composer.PinyinNumsToSurf(x.Pinyin);
            }

            // Done
            return res;
        }

        string makeParaXml(List<XieChar> para)
        {
            var words = makeWords(para);
            StringBuilder sb = new StringBuilder();
            foreach (var word in words)
            {
                if (word.Hanzi == "")
                    sb.Append(skText.Replace("<!-- TEXT -->", esc(word.Pinyin)));
                else
                {
                    string txt = skRubyWord.Replace("<!-- HANZI -->", esc(word.Hanzi));
                    txt = txt.Replace("<!-- PINYIN -->", esc(word.Pinyin));
                    sb.Append(txt);
                }
            }
            return sb.ToString();
        }

        static List<List<XieChar>> textToParas(XieChar[] text)
        {
            var res = new List<List<XieChar>>();
            List<XieChar> currPara = new List<XieChar>();
            foreach (var xc in text)
            {
                if (xc.Hanzi != "\n") currPara.Add(xc);
                else
                {
                    res.Add(currPara);
                    currPara = new List<XieChar>();
                }
            }
            if (currPara.Count != 0) res.Add(currPara);
            return res;
        }

        string makeDocXml(List<List<XieChar>> paras)
        {
            StringBuilder sb = new StringBuilder();
            foreach (var para in paras)
            {
                string textStr = makeParaXml(para);
                string paraStr = skPara;
                paraStr = paraStr.Replace("<!-- TEXT -->", textStr);
                sb.Append(paraStr);
            }
            return skDocument.Replace("<!-- CONTENT -->", sb.ToString());
        }

        public async Task Export()
        {
            await Task.Run(() =>
            {
                var paras = textToParas(text);
                string docXml = makeDocXml(paras);
                makeZip(fname, docXml);
            });
        }
    }
}
