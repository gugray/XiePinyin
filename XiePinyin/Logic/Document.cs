using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace XiePinyin.Logic
{
    class Document
    {
        public readonly string DocId;
        public string Name;
        public readonly XieChar[] StartText;
        public readonly List<Revision> Revisions = new List<Revision>();
        public readonly XieChar[] HeadText;

        public Document(string docId, string name, XieChar[] startText = null)
        {
            DocId = docId ?? throw new ArgumentNullException(nameof(docId));
            Name = name ?? throw new ArgumentNullException(nameof(name));
            StartText = startText ?? new XieChar[0];
            HeadText = StartText;
            Revisions.Add(new Revision(ChangeSet.CreateIdent(StartText.Length)));
        }

        public ChangeSet ApplyChange(ChangeSet cs, int baseRevId)
        {
            // TO-DO
            return ChangeSet.CreateIdent(0);
        }
    }
}
