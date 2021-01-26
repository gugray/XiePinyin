using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

using Newtonsoft.Json;

namespace XiePinyin.Logic
{
    class Document
    {
        [JsonProperty("docId")]
        public readonly string DocId;

        [JsonProperty("name")]
        public string Name { get; private set; }

        [JsonProperty("startText")]
        public readonly XieChar[] StartText;

        [JsonIgnore]
        public readonly List<Revision> Revisions = new List<Revision>();
        
        [JsonIgnore]
        public XieChar[] HeadText { get; private set; }

        [JsonIgnore]
        public bool Dirty = false;

        [JsonIgnore]
        public DateTime LastChanged = DateTime.UtcNow;

        public Document(string docId, string name, XieChar[] startText = null)
        {
            DocId = docId ?? throw new ArgumentNullException(nameof(docId));
            Name = name ?? throw new ArgumentNullException(nameof(name));
            StartText = startText ?? new XieChar[0];
            HeadText = StartText;
            Revisions.Add(new Revision(ChangeSet.CreateIdent(StartText.Length)));
        }

        public void SaveToFile(string fn)
        {
            // We save head: it will be start text upon deserialization
            // I.e., we don't save history.
            var toSave = new Document(DocId, Name, HeadText);
            string json = JsonConvert.SerializeObject(toSave, Formatting.Indented);
            Dirty = false;
            // Save in background thready, so caller can move on with their life
            // This save function gets called from within a lock
            File.WriteAllTextAsync(fn, json).ContinueWith(t =>
            {
                // If so desired, log t.Exception;
            }, TaskContinuationOptions.OnlyOnFaulted);
        }

        public static Document LoadFromFile(string fn)
        {
            using (var sr = new StreamReader(fn))
            {
                JsonSerializer ser = new JsonSerializer();
                var res = (Document)ser.Deserialize(sr, typeof(Document));
                res.HeadText = res.StartText;
                res.Revisions.Add(new Revision(ChangeSet.CreateIdent(res.StartText.Length)));
                return res;
            }
        }

        public void ChangeName(string newName)
        {
            Name = newName;
            Dirty = true;
            LastChanged = DateTime.UtcNow;
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
            Dirty = true;
            LastChanged = DateTime.UtcNow;
            return csf;
        }
    }
}
