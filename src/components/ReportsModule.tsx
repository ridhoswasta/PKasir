import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function ReportsModule() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [moneyFlow, setMoneyFlow] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/transactions').then(res => res.json()).then(setTransactions);
    fetch('/api/money-flow').then(res => res.json()).then(setMoneyFlow);
  }, []);

  const totalSales = transactions.reduce((sum, t) => sum + t.total, 0);
  const totalTransactions = transactions.length;

  // 1. Transaction Report Data
  const dailyDataMap = transactions.reduce((acc, t) => {
    const date = format(new Date(t.date), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = { date, omset: 0, count: 0 };
    acc[date].omset += t.total;
    acc[date].count += 1;
    return acc;
  }, {});
  const chartData = Object.values(dailyDataMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

  // 2. Product Sales Data
  const productSalesMap = transactions.reduce((acc, t) => {
    t.items.forEach((item: any) => {
      if (!acc[item.name]) acc[item.name] = { name: item.name, quantity: 0, total: 0 };
      acc[item.name].quantity += item.quantity;
      acc[item.name].total += item.price * item.quantity;
    });
    return acc;
  }, {});
  const productData = Object.values(productSalesMap).sort((a: any, b: any) => b.total - a.total);

  // 3. Payment Method Data
  const paymentSalesMap = transactions.reduce((acc, t) => {
    if (!acc[t.paymentMethod]) acc[t.paymentMethod] = { method: t.paymentMethod, total: 0, count: 0 };
    acc[t.paymentMethod].total += t.total;
    acc[t.paymentMethod].count += 1;
    return acc;
  }, {});
  const paymentData = Object.values(paymentSalesMap);

  // 4. Profit/Loss Data
  let totalHargaJual = 0;
  let totalHargaPokok = 0;
  transactions.forEach(t => {
    t.items.forEach((item: any) => {
      totalHargaJual += item.price * item.quantity;
      totalHargaPokok += (item.costPrice || 0) * item.quantity;
    });
  });
  const totalLabaRugiSales = totalHargaJual - totalHargaPokok;

  const totalPemasukanLain = moneyFlow.filter(f => f.type === 'Pemasukan' && f.category !== 'Penjualan').reduce((sum, f) => sum + f.amount, 0);
  const totalPengeluaran = moneyFlow.filter(f => f.type === 'Pengeluaran').reduce((sum, f) => sum + f.amount, 0);
  const labaBersih = totalLabaRugiSales + totalPemasukanLain - totalPengeluaran;

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <h2 className="text-3xl font-bold text-slate-800">Laporan & Analitik</h2>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transactions">Laporan Transaksi</TabsTrigger>
          <TabsTrigger value="products">Penjualan Produk</TabsTrigger>
          <TabsTrigger value="payments">Metode Pembayaran</TabsTrigger>
          <TabsTrigger value="profit">Laba Rugi</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-amber-400 text-amber-950">
              <CardContent className="p-6 flex flex-col items-center justify-center">
                <p className="text-sm font-medium opacity-80">Jumlah Omset</p>
                <h3 className="text-3xl font-bold">Rp {totalSales.toLocaleString('id-ID')}</h3>
                <p className="text-xs opacity-70 mt-1">Rata-rata: Rp {totalTransactions > 0 ? Math.round(totalSales / totalTransactions).toLocaleString('id-ID') : 0}</p>
              </CardContent>
            </Card>
            <Card className="bg-cyan-600 text-white">
              <CardContent className="p-6 flex flex-col items-center justify-center">
                <p className="text-sm font-medium opacity-80">Jumlah Transaksi</p>
                <h3 className="text-3xl font-bold">{totalTransactions}</h3>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Grafik Transaksi Harian</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] min-h-0 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(tick) => format(new Date(tick), 'dd MMM', { locale: id })} />
                  <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
                  <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" />
                  <Tooltip 
                    labelFormatter={(label) => format(new Date(label), 'dd MMMM yyyy', { locale: id })}
                    formatter={(value, name) => [name === 'omset' ? `Rp ${Number(value).toLocaleString('id-ID')}` : value, name === 'omset' ? 'Omset' : 'Transaksi']}
                  />
                  <Legend />
                  <Bar yAxisId="right" dataKey="count" name="Transaksi" fill="#fca5a5" barSize={20} />
                  <Area yAxisId="left" type="monotone" dataKey="omset" name="Omset" fill="#93c5fd" stroke="#3b82f6" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="text-center">Jml Transaksi</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((data: any, index: number) => (
                    <TableRow key={data.date}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{data.date}</TableCell>
                      <TableCell className="text-center">{data.count}</TableCell>
                      <TableCell className="text-right">Rp {data.omset.toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-cyan-600 hover:bg-cyan-600 text-white font-bold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-center">{totalTransactions}</TableCell>
                    <TableCell className="text-right">Rp {totalSales.toLocaleString('id-ID')}</TableCell>
                  </TableRow>
                  <TableRow className="bg-amber-400 hover:bg-amber-400 text-amber-950 font-bold">
                    <TableCell colSpan={2}>Rata-rata</TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-right">Rp {totalTransactions > 0 ? Math.round(totalSales / totalTransactions).toLocaleString('id-ID') : 0}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Penjualan Berdasarkan Produk</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead className="text-center">Terjual</TableHead>
                    <TableHead className="text-right">Total Penjualan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productData.map((item: any) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">Rp {item.total.toLocaleString('id-ID')}</TableCell>
                    </TableRow>
                  ))}
                  {productData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-slate-500">Belum ada data penjualan</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Metode Pembayaran</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metode</TableHead>
                      <TableHead className="text-center">Transaksi</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentData.map((item: any) => (
                      <TableRow key={item.method}>
                        <TableCell className="font-medium">{item.method}</TableCell>
                        <TableCell className="text-center">{item.count}</TableCell>
                        <TableCell className="text-right">Rp {item.total.toLocaleString('id-ID')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Distribusi Pembayaran</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] min-h-0 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="total"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString('id-ID')}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="profit" className="space-y-4 mt-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center border-b">
              <CardTitle className="text-2xl">Laporan Laba Rugi</CardTitle>
              <p className="text-slate-500">Periode Keseluruhan</p>
            </CardHeader>
            <CardContent className="pt-6 space-y-8">
              
              {/* Penjualan Section */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Penjualan:</h3>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Harga Jual</span>
                  <span>Rp {totalHargaJual.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Harga Pokok</span>
                  <span>Rp {totalHargaPokok.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between py-2 bg-cyan-600 text-white px-3 font-bold mt-2">
                  <span>Total Laba Rugi</span>
                  <span>Rp {totalLabaRugiSales.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Pemasukan Section */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Pemasukan (Lainnya):</h3>
                {moneyFlow.filter(f => f.type === 'Pemasukan' && f.category !== 'Penjualan').length === 0 ? (
                  <p className="text-slate-400 italic py-1">Tidak ada data pemasukan lainnya</p>
                ) : (
                  moneyFlow.filter(f => f.type === 'Pemasukan' && f.category !== 'Penjualan').map(f => (
                    <div key={f.id} className="flex justify-between py-1">
                      <span className="text-slate-600">{f.description || f.category}</span>
                      <span>Rp {f.amount.toLocaleString('id-ID')}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-2 bg-emerald-600 text-white px-3 font-bold mt-2">
                  <span>Total Pemasukan</span>
                  <span>Rp {totalPemasukanLain.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Pengeluaran Section */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 border-b pb-2">Pengeluaran:</h3>
                {moneyFlow.filter(f => f.type === 'Pengeluaran').length === 0 ? (
                  <p className="text-slate-400 italic py-1">Tidak ada data pengeluaran</p>
                ) : (
                  moneyFlow.filter(f => f.type === 'Pengeluaran').map(f => (
                    <div key={f.id} className="flex justify-between py-1">
                      <span className="text-slate-600">{f.description || f.category}</span>
                      <span>Rp {f.amount.toLocaleString('id-ID')}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-2 bg-red-600 text-white px-3 font-bold mt-2">
                  <span>Total Pengeluaran</span>
                  <span>Rp {totalPengeluaran.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Laba Bersih */}
              <div className="flex justify-between py-3 bg-amber-400 text-amber-950 px-4 font-bold text-lg mt-8 shadow-sm">
                <span>Laba Bersih</span>
                <span>Rp {labaBersih.toLocaleString('id-ID')}</span>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
