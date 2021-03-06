﻿using System;
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
        public DateTime LastAccessedUtc = DateTime.UtcNow;

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
            string json = serializeToJson();
            Dirty = false;
            // Save in background thready, so caller can move on with their life
            // This save function gets called from within a lock
            File.WriteAllTextAsync(fn, json).ContinueWith(t =>
            {
                // If so desired, log t.Exception;
            }, TaskContinuationOptions.OnlyOnFaulted);
        }

        string serializeToJson()
        {
            // We save head: it will be start text upon deserialization
            // I.e., we don't save history.
            var toSave = new Document(DocId, Name, HeadText);
            string json = JsonConvert.SerializeObject(toSave, Formatting.Indented);
            return json;
        }

        static Document deserializeFromJson(TextReader sr)
        {
            JsonSerializer ser = new JsonSerializer();
            var res = (Document)ser.Deserialize(sr, typeof(Document));
            res.HeadText = res.StartText;
            res.Revisions.Add(new Revision(ChangeSet.CreateIdent(res.StartText.Length)));
            return res;
        }

        public static Document LoadFromFile(string fn)
        {
            using (var sr = new StreamReader(fn))
            {
                return deserializeFromJson(sr);
            }
        }

        public void ChangeName(string newName)
        {
            Name = newName;
            Dirty = true;
            LastAccessedUtc = DateTime.UtcNow;
        }

        /// <summary>
        /// Calculates forward of selection from a client, so it applies to current head text.
        /// </summary>
        /// <param name="sel">Selection communicated by the client.</param>
        /// <param name="baseRevId">Client's revision ID, to which selection applies.</param>
        /// <returns>Selection forwarded to current head.</returns>
        public Selection ForwardSelection(Selection sel, int baseRevId)
        {
            LastAccessedUtc = DateTime.UtcNow;
            var poss = new int[] { sel.Start, sel.End };
            for (int i = baseRevId + 1; i < Revisions.Count; ++i)
                ChangeSet.ForwardPositions(Revisions[i].ChangeSet, poss);
            return new Selection { Start = poss[0], End = poss[1], CaretAtStart = sel.CaretAtStart };
        }

        /// <summary>
        /// Applies a changeset received from a client to the document.
        /// </summary>
        /// <param name="cs">Changeset received from client.</param>
        /// <param name="baseRevId">Client's head revision ID (latest revision they are aware of; this is what the change is based on).</param>
        /// <param name="csToProp">Computed new changeset added to the end of document's master revision list.</param>
        /// <param name="selToProp">Computed new selection, forwarded head text.</param>
        public void ApplyChange(ChangeSet cs, Selection sel, int baseRevId, out ChangeSet csToProp, out Selection selInHead)
        {
            // Compute sequence of follows so we get changeset that applies to our latest revision
            // Server's head might be ahead of the revision known to the client, which is what this CS is based on.
            csToProp = cs;
            var poss = new int[] { sel.Start, sel.End };
            for (int i = baseRevId + 1; i < Revisions.Count; ++i)
            {
                csToProp = ChangeSet.Follow(Revisions[i].ChangeSet, csToProp);
                ChangeSet.ForwardPositions(Revisions[i].ChangeSet, poss);
            }
            Revisions.Add(new Revision(csToProp));
            HeadText = ChangeSet.Apply(HeadText, csToProp);
            Dirty = true;
            LastAccessedUtc = DateTime.UtcNow;
            selInHead = new Selection { Start = poss[0], End = poss[1], CaretAtStart = sel.CaretAtStart };
        }
    }
}
