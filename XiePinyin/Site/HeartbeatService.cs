using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace XiePinyin.Site
{
    internal class HeartbeatService : IHostedService
    {
        private readonly ConnectionManager _connectionManager;
        private Task _heartbeatTask;
        private CancellationTokenSource _cancellationTokenSource;

        public HeartbeatService(ConnectionManager connectionManager)
        {
            _connectionManager = connectionManager;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            _cancellationTokenSource = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            _heartbeatTask = HeartbeatAsync(_cancellationTokenSource.Token);
            return _heartbeatTask.IsCompleted ? _heartbeatTask : Task.CompletedTask;
        }

        public async Task StopAsync(CancellationToken cancellationToken)
        {
            if (_heartbeatTask != null)
            {
                _cancellationTokenSource.Cancel();
                await Task.WhenAny(_heartbeatTask, Task.Delay(-1, cancellationToken));
                cancellationToken.ThrowIfCancellationRequested();
            }
        }

        private async Task HeartbeatAsync(CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                await _connectionManager.BeepToAllAsync(cancellationToken);
                await _connectionManager.CloseStaleConnections();
                await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            }
        }
    }
}
