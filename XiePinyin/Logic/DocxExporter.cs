using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Logic
{
    internal class DocxExporter
    {
        readonly XieChar[] text;
        readonly string fname;

        public DocxExporter(XieChar[] text, string fname)
        {
            this.text = text;
            this.fname = fname;
        }

        public static void Housekeep(string folder)
        {
            // TO-DO: Have document juggler call this
        }

        public async Task Export()
        {
            // TO-DO: Generate DOCX file
        }
    }
}
