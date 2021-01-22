using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace XiePinyin.Logic
{
    class Revision
    {
        public readonly ChangeSet ChangeSet;

        public Revision(ChangeSet changeSet)
        {
            ChangeSet = changeSet ?? throw new ArgumentNullException(nameof(changeSet));
        }
    }
}
