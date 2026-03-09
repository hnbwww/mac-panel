import * as si from 'systeminformation';

interface SystemStats {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
    speed: number;
    manufacturer?: string;
    brand?: string;
    vendor?: string;
    family?: string;
    model?: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
    swap: {
      total: number;
      used: number;
      free: number;
    };
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
    partitions: Array<{
      mount: string;
      size: number;
      used: number;
      free: number;
      usage: number;
    }>;
  };
  network: {
    rx: number;
    tx: number;
    interfaces: Array<{
      name: string;
      rx: number;
      tx: number;
    }>;
  };
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    release: string;
  };
}

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  user: string;
  status: string;
  command: string;
  ports?: number[];  // 进程监听的端口列表
  fullCommand?: string;  // 完整命令行（包含所有参数）
}

class SystemInfoService {
  private statsCache: SystemStats | null = null;
  private cacheTime: number = 0;
  private cacheDuration: number = 1000; // 缓存 1 秒
  private wsClients: Set<any>;

  constructor() {
    this.wsClients = new Set();
  }

  // 添加 WebSocket 客户端
  addWebSocketClient(ws: any): void {
    this.wsClients.add(ws);

    ws.on('close', () => {
      this.wsClients.delete(ws);
    });
  }

  // 广播系统状态更新
  async broadcastStats(): Promise<void> {
    const stats = await this.getSystemStats();
    const message = JSON.stringify({
      type: 'system-stats',
      data: stats
    });

    this.wsClients.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(message);
      } else {
        this.wsClients.delete(ws);
      }
    });
  }

  // 启动定时广播
  startBroadcasting(interval: number = 1000): void {
    setInterval(() => {
      this.broadcastStats().catch(console.error);
    }, interval);
  }

  // 获取完整系统信息
  async getSystemStats(): Promise<SystemStats> {
    const now = Date.now();

    // 检查缓存
    if (this.statsCache && (now - this.cacheTime) < this.cacheDuration) {
      return this.statsCache;
    }

    try {
      // 并行获取所有信息
      const [cpu, mem, osInfo, diskLayout, networkStats, networkInterfaces] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.osInfo(),
        si.fsSize(),
        si.networkStats(),
        si.networkInterfaces()
      ]);

      // 计算网络总流量
      const totalRx = networkStats.reduce((sum: number, iface: any) => sum + (iface.rx_bytes || iface.rx_sec || 0), 0);
      const totalTx = networkStats.reduce((sum: number, iface: any) => sum + (iface.tx_bytes || iface.tx_sec || 0), 0);

      // 格式化网络接口
      const interfaces = networkInterfaces.map((iface: any) => ({
        name: iface.iface,
        rx: iface.rx_bytes || iface.rx_sec || 0,
        tx: iface.tx_bytes || iface.tx_sec || 0
      }));

      // 格式化磁盘分区
      const partitions = diskLayout.map(partition => ({
        mount: partition.mount,
        size: partition.size,
        used: partition.used,
        free: partition.size - partition.used,
        usage: partition.use
      }));

      // 计算总磁盘使用量（使用根分区/的数据，避免重复计算）
      // 在macOS上，/System/Volumes/Data等挂载点实际上是同一个物理磁盘的不同视图
      const rootPartition = diskLayout.find((d: any) => d.mount === '/') ||
                           diskLayout.find((d: any) => d.mount === '/System/Volumes/Data') ||
                           diskLayout.reduce((max: any, d: any) => d.size > max.size ? d : max, diskLayout[0]);

      const totalDiskSize = rootPartition?.size || 0;
      const totalDiskUsed = rootPartition?.used || 0;
      // 使用available字段而不是计算值，因为APFS等现代文件系统有快照等功能
      const totalDiskFree = rootPartition?.available || 0;

      // 获取 CPU 信息和系统时间
      const [cpuInfo, time] = await Promise.all([
        si.cpu(),
        si.time()
      ]);

      const stats: SystemStats = {
        cpu: {
          usage: cpu.currentLoad || 0,
          cores: cpu.cpus?.length || 0,
          loadAverage: [cpu.avgLoad || 0, 0, 0],
          speed: cpuInfo.speed,
          manufacturer: cpuInfo.manufacturer,
          brand: cpuInfo.brand,
          vendor: cpuInfo.vendor,
          family: cpuInfo.family,
          model: cpuInfo.model
        },
        memory: {
          total: mem.total,
          used: mem.active,
          free: mem.available,
          usage: (mem.active / mem.total) * 100,
          swap: {
            total: mem.swaptotal,
            used: mem.swapused,
            free: mem.swaptotal - mem.swapused
          }
        },
        disk: {
          total: totalDiskSize,
          used: totalDiskUsed,
          free: totalDiskFree,
          usage: (totalDiskUsed / totalDiskSize) * 100,
          partitions
        },
        network: {
          rx: totalRx,
          tx: totalTx,
          interfaces
        },
        system: {
          platform: osInfo.platform,
          arch: osInfo.arch,
          hostname: osInfo.hostname,
          uptime: time.uptime,
          release: osInfo.release
        }
      };

      this.statsCache = stats;
      this.cacheTime = now;

      return stats;
    } catch (error) {
      console.error('Failed to get system stats:', error);
      throw error;
    }
  }

  // 获取 CPU 信息
  async getCpuInfo(): Promise<any> {
    try {
      const [cpu, cpuLoad, cpuTemp] = await Promise.all([
        si.cpu(),
        si.currentLoad(),
        si.cpuTemperature().catch(() => ({ main: -1, cores: [] }))
      ]);

      return {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        speed: cpu.speed,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors,
        usage: cpuLoad.currentLoad || 0,
        loadAverage: [cpuLoad.avgLoad || 0, 0, 0],
        temperature: cpuTemp.main,
        coresTemp: cpuTemp.cores
      };
    } catch (error) {
      console.error('Failed to get CPU info:', error);
      throw error;
    }
  }

  // 获取内存信息
  async getMemoryInfo(): Promise<any> {
    try {
      const mem = await si.mem();
      return {
        total: mem.total,
        free: mem.free,
        used: mem.active,
        available: mem.available,
        buffcache: mem.buffcache,
        swaptotal: mem.swaptotal,
        swapused: mem.swapused,
        swapfree: mem.swaptotal - mem.swapused,
        usage: (mem.active / mem.total) * 100
      };
    } catch (error) {
      console.error('Failed to get memory info:', error);
      throw error;
    }
  }

  // 获取磁盘信息
  async getDiskInfo(): Promise<any> {
    try {
      const [diskLayout, fsSize] = await Promise.all([
        si.diskLayout(),
        si.fsSize()
      ]);

      return {
        disks: diskLayout.map(disk => ({
          type: disk.type,
          name: disk.name,
          vendor: disk.vendor,
          size: disk.size,
          bytesPerSector: disk.bytesPerSector,
          totalCylinders: disk.totalCylinders
        })),
        fileSystems: fsSize.map(fs => ({
          fs: fs.fs,
          type: fs.type,
          size: fs.size,
          used: fs.used,
          use: fs.use,
          mount: fs.mount
        }))
      };
    } catch (error) {
      console.error('Failed to get disk info:', error);
      throw error;
    }
  }

  // 获取网络信息
  async getNetworkInfo(): Promise<any> {
    try {
      const [networkInterfaces, networkStats] = await Promise.all([
        si.networkInterfaces(),
        si.networkStats()
      ]);

      return {
        interfaces: networkInterfaces.map(iface => ({
          iface: iface.iface,
          ifaceName: iface.ifaceName,
          ip4: iface.ip4,
          ip6: iface.ip6,
          mac: iface.mac,
          internal: iface.internal,
          virtual: iface.virtual,
          operstate: iface.operstate,
          type: iface.type,
          duplex: iface.duplex,
          mtu: iface.mtu,
          speed: iface.speed,
          dhcp: iface.dhcp
        })),
        stats: networkStats.map(stat => ({
          iface: stat.iface,
          rx_bytes: stat.rx_bytes,
          tx_bytes: stat.tx_bytes,
          rx_sec: stat.rx_sec,
          tx_sec: stat.tx_sec,
          ms: stat.ms
        }))
      };
    } catch (error) {
      console.error('Failed to get network info:', error);
      throw error;
    }
  }

  // 获取进程监听的端口
  private async getProcessPorts(pid: number): Promise<number[]> {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        // 使用 lsof 命令获取进程打开的端口
        exec(`lsof -p ${pid} -a -i -nP 2>/dev/null | awk 'NR>1 {print $9}' | grep '.*:[0-9]*' | awk -F: '{print $2}' | sort -nu`, (error: any, stdout: string) => {
          if (error || !stdout.trim()) {
            resolve([]);
            return;
          }
          const ports = stdout.trim().split('\n').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
          resolve(ports);
        });
      });
    } catch (error) {
      console.error(`Failed to get ports for PID ${pid}:`, error);
      return [];
    }
  }

  // 获取进程的完整命令行
  private async getProcessFullCommand(pid: number): Promise<string> {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`ps -p ${pid} -o command= 2>/dev/null`, (error: any, stdout: string) => {
          if (error || !stdout.trim()) {
            resolve('');
            return;
          }
          resolve(stdout.trim());
        });
      });
    } catch (error) {
      console.error(`Failed to get full command for PID ${pid}:`, error);
      return '';
    }
  }

  // 获取进程列表
  async getProcesses(limit?: number, sort?: 'cpu' | 'mem'): Promise<{ processes: ProcessInfo[]; total: number }> {
    try {
      const processes = await si.processes();
      let list = processes.list;

      // 按 CPU 或内存排序
      if (sort === 'cpu') {
        list = list.sort((a, b) => b.cpu - a.cpu);
      } else if (sort === 'mem') {
        list = list.sort((a, b) => b.mem - a.mem);
      }

      // 限制数量
      if (limit) {
        list = list.slice(0, limit);
      }

      // 获取所有进程的端口和完整命令行（并发处理以提高性能）
      const processPromises = list.map(async (proc) => {
        const [ports, fullCommand] = await Promise.all([
          this.getProcessPorts(proc.pid),
          this.getProcessFullCommand(proc.pid)
        ]);

        return {
          pid: proc.pid,
          name: proc.name,
          cpu: proc.cpu,
          memory: proc.mem,
          user: proc.user,
          status: proc.state,
          command: proc.command,
          ports: ports.length > 0 ? ports : undefined,
          fullCommand: fullCommand || undefined
        };
      });

      const formattedList: ProcessInfo[] = await Promise.all(processPromises);

      return {
        processes: formattedList,
        total: processes.all
      };
    } catch (error) {
      console.error('Failed to get processes:', error);
      throw error;
    }
  }

  // 获取指定进程信息
  async getProcessInfo(pid: number): Promise<any> {
    try {
      // systeminformation doesn't have processLoad, using processes instead
      const processes = await si.processes();
      const process = processes.list.find(p => p.pid === pid);
      return process || null;
    } catch (error) {
      console.error(`Failed to get process info for PID ${pid}:`, error);
      throw error;
    }
  }

  // 终止进程 (using Node.js built-in process.kill)
  async killProcess(pid: number, signal?: string): Promise<boolean> {
    try {
      process.kill(pid, signal as any || 'SIGTERM');
      return true;
    } catch (error) {
      console.error(`Failed to kill process ${pid}:`, error);
      throw error;
    }
  }

  // 获取系统时间
  async getSystemTime(): Promise<any> {
    try {
      const [time, osInfo] = await Promise.all([
        si.time(),
        si.osInfo()
      ]);

      return {
        current: time.current,
        uptime: time.uptime,
        timezone: time.timezone,
        timezoneName: time.timezoneName,
        dst: false // systeminformation doesn't provide this in newer versions
      };
    } catch (error) {
      console.error('Failed to get system time:', error);
      throw error;
    }
  }

  // 获取电池信息（笔记本）
  async getBatteryInfo(): Promise<any> {
    try {
      const battery = await si.battery();
      return {
        hasBattery: battery.hasBattery,
        cycleCount: battery.cycleCount,
        isCharging: battery.isCharging,
        maxCapacity: battery.maxCapacity,
        currentCapacity: battery.currentCapacity,
        percent: battery.percent,
        timeRemaining: battery.timeRemaining,
        acConnected: battery.acConnected
      };
    } catch (error) {
      // 某些系统可能不支持电池信息
      return { hasBattery: false };
    }
  }

  // 获取系统运行时间
  async getSystemUptime(): Promise<number> {
    try {
      const time = await si.time();
      return time.uptime;
    } catch (error) {
      console.error('Failed to get system uptime:', error);
      return 0;
    }
  }
}

// 导出单例
export const systemInfoService = new SystemInfoService();
