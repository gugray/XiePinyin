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
        public XieChar[] HeadText;

        public Document(string docId, string name, XieChar[] startText = null)
        {
            DocId = docId ?? throw new ArgumentNullException(nameof(docId));
            Name = name ?? throw new ArgumentNullException(nameof(name));
            StartText = startText ?? new XieChar[0];
            HeadText = StartText;
            Revisions.Add(new Revision(ChangeSet.CreateIdent(StartText.Length)));
        }

        /// <summary>
        /// Applies a changeset received from a client to the document.
        /// </summary>
        /// <param name="cs">Changeset received from client.</param>
        /// <param name="baseRevId">Client's head revision ID (latest revision they are aware of; this is what the change is based on).</param>
        /// <returns>Computed new changeset added to the end of document's master revision list.</returns>
        public ChangeSet ApplyChange(ChangeSet cs, int baseRevId)
        {
            // Compute sequence of follows so we get changeset that applies to our latest revision
            // Server's head might be ahead of the revision known to the client, which is what this CS is based on.
            var csf = cs;
            for (int i = baseRevId + 1; i < Revisions.Count; ++i)
            {
                csf = ChangeSet.Follow(Revisions[i].ChangeSet, csf);
            }
            Revisions.Add(new Revision(csf));
            HeadText = ChangeSet.Apply(HeadText, csf);
            return csf;
        }
    }
}
