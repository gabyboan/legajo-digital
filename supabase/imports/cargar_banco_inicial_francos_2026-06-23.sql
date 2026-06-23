-- Carga inicial de banco de horas desde C:/Users/som/Documents/francos horas totales.pdf
-- Fecha solicitada: 2026-06-23
-- Convencion: celdas vacias de horas/minutos = 0. Los saldos 0 se incluyen para dejar registro explicito.
-- Revisar primero el CSV hermano: supabase/imports/francos_horas_totales_2026-06-23.csv

begin;

-- Carga directa como postgres desde SQL Editor: no usa la RPC porque esa valida maximo diario de 6 horas.
-- Usuario auditor tomado de auth.users/public.usuarios.


create temp table tmp_banco_inicial_francos_pdf (
  dni integer not null,
  horas integer not null,
  minutos_resto integer not null,
  total_minutos integer not null,
  apellido_nombres text not null,
  notas text not null
) on commit drop;

insert into tmp_banco_inicial_francos_pdf
  (dni, horas, minutos_resto, total_minutos, apellido_nombres, notas)
values
    (24831430, 836, 0, 50160, 'Acevedo Mi', ''),
    (39031433, 12, 30, 750, 'Acosta Sant', ''),
    (34824814, 101, 0, 6060, 'Aguilar Flav', ''),
    (25861834, 324, 0, 19440, 'Aguilar Pao', ''),
    (27835592, 220, 30, 13230, 'Aguirre Dan', ''),
    (29855090, 456, 0, 27360, 'Albornoz Ri', ''),
    (35749046, 59, 0, 3540, 'Albrecht Ma', ''),
    (24980233, 20, 45, 1245, 'Alcain Paula', ''),
    (38793952, 0, 0, 0, 'Alfaro Camila', ''),
    (31521669, 491, 0, 29460, 'Alles Daniel', ''),
    (25684329, 35, 0, 2100, 'Alvarenga M', ''),
    (32565396, 14, 15, 855, 'Alvarez Me', ''),
    (36202710, 0, 0, 0, 'Amarilla Ramiro Manuel', ''),
    (27617556, 133, 0, 7980, 'Arevalo Ma', ''),
    (21856414, 153, 0, 9180, 'Arevalo Mo', ''),
    (32029561, 237, 0, 14220, 'Arias Anabe', ''),
    (35707005, 5, 0, 300, 'Arin Eva M', ''),
    (36704150, 9, 0, 540, 'Arrua Noeli', ''),
    (23696632, 111, 0, 6660, 'Balcaza Mar', ''),
    (27006961, 20, 45, 1245, 'Ballesteros M', ''),
    (30322855, 7, 45, 465, 'Barbieri Flav', ''),
    (34495644, 16, 30, 990, 'Barsotti Ote', ''),
    (31281925, 520, 0, 31200, 'Bartoli Luci', ''),
    (41188140, 51, 15, 3075, 'Battaglia Ar', ''),
    (35452608, 126, 0, 7560, 'Battu MarÃ­a', ''),
    (29855728, 232, 0, 13920, 'Belbey Dieg', ''),
    (23975730, 29, 0, 1740, 'Beltzer Silvi', ''),
    (26332298, 53, 0, 3180, 'Benaben Ca', ''),
    (35121248, 76, 30, 4590, 'Benedetti Li', ''),
    (34014588, 354, 0, 21240, 'Benitez Jesic', ''),
    (22737157, 3, 45, 225, 'Bertoni Cris', ''),
    (28132554, 560, 0, 33600, 'Betti Maria', ''),
    (30164196, 549, 0, 32940, 'Bier Gladys', ''),
    (41043818, 2, 0, 120, 'Boan Gabrie', ''),
    (23190949, 56, 30, 3390, 'Boeykens M', ''),
    (30164422, 65, 0, 3900, 'Bolzan And', ''),
    (27157345, 92, 0, 5520, 'Britos Juan M', ''),
    (29024702, 1, 15, 75, 'Britos Pame', ''),
    (34972716, 215, 30, 12930, 'Brown Noel', ''),
    (28135739, 98, 0, 5880, 'Bruna Rami', ''),
    (29447216, 27, 0, 1620, 'Brunner Elo', ''),
    (21427673, 325, 0, 19500, 'Bucarello En', ''),
    (31232746, 12, 30, 750, 'Burgoa Geo', ''),
    (37976623, 268, 0, 16080, 'CabaÃ±a Facu', ''),
    (36651173, 228, 0, 13680, 'Cabrera Jud', ''),
    (28471521, 0, 0, 0, 'Caceres Ivan', ''),
    (30187025, 41, 30, 2490, 'Caceres Mir', ''),
    (37080822, 485, 0, 29100, 'Campovila J', ''),
    (35440521, 161, 0, 9660, 'Canteros Fa', ''),
    (37562055, 62, 0, 3720, 'Canteros Fio', ''),
    (32830961, 537, 0, 32220, 'Cardozo Cr', ''),
    (28647754, 45, 45, 2745, 'Carruego A', ''),
    (36703656, 154, 30, 9270, 'Casella Noe', ''),
    (29855471, 118, 45, 7125, 'CastaÃ±eda L', ''),
    (33424348, 124, 15, 7455, 'Castro Julie', ''),
    (33684346, 0, 0, 0, 'Cepeda Gonzalo Miguel', ''),
    (38387748, -12, 0, -720, 'Comas Juan', ''),
    (23695251, -15, 0, -900, 'Contardo Luis Jose', ''),
    (36103990, 252, 0, 15120, 'Copello Dep', ''),
    (41154089, 3, 0, 180, 'Cortz Flavio', ''),
    (28257010, 41, 0, 2460, 'Cuevas Fer', ''),
    (26410381, 304, 30, 18270, 'Cuevas And', ''),
    (33505992, 0, 0, 0, 'Curotto Maria Eugenia', ''),
    (34299710, 10, 0, 600, 'David MarÃ­', ''),
    (27006379, -5, 0, -300, 'Deangeli Se', ''),
    (28676358, 641, 0, 38460, 'Delfino Luc', ''),
    (37545868, 11, 15, 675, 'Demichelis', ''),
    (26048375, 81, 0, 4860, 'Depardon A', ''),
    (34549573, 47, 30, 2850, 'Diaz Camila', ''),
    (28014184, 1097, 30, 65850, 'Diaz Dante', ''),
    (23476823, 96, 30, 5790, 'Diaz Lorena', ''),
    (32029525, 0, 0, 0, 'Dominguez Maria Pilar', ''),
    (34163533, 85, 0, 5100, 'Donda Luca', ''),
    (37223337, 327, 0, 19620, 'Duarte Facu', ''),
    (24899524, 2, 0, 120, 'Duarte Julia', ''),
    (28647653, 3, 0, 180, 'Elcura MarÃ­', ''),
    (35250459, 29, 0, 1740, 'Else Jesica L', ''),
    (41868117, 63, 0, 3780, 'Emeri Pame', ''),
    (32833991, 284, 30, 17070, 'Escoubue M', ''),
    (28257584, 252, 30, 15150, 'Espindola A', ''),
    (28647917, 6, 0, 360, 'Espinosa Ca', ''),
    (31788415, 93, 0, 5580, 'Eurich Nadi', ''),
    (26889591, 128, 30, 7710, 'Evans Rhys', ''),
    (31333398, -5, 0, -300, 'Fael Brenda', ''),
    (27346257, 98, 0, 5880, 'Fardella Elia', ''),
    (28676175, 0, 0, 0, 'Fernandez C', ''),
    (20298889, 292, 0, 17520, 'Fernandez G', ''),
    (28257396, 4, 15, 255, 'Ferrari Stell', ''),
    (18834506, 399, 45, 23985, 'Figueroa Ko', ''),
    (31017354, 13, 30, 810, 'Firpo Maria', ''),
    (36589582, 39, 30, 2370, 'Flor Solange', ''),
    (35708720, 176, 0, 10560, 'Fonseca Seb', ''),
    (28069809, 432, 0, 25920, 'Fraile Maria', ''),
    (32833768, 86, 0, 5160, 'Franco Guil', ''),
    (29855788, 100, 15, 6015, 'Galarraga M', ''),
    (38054911, 186, 15, 11175, 'Gallardo Ga', ''),
    (28961975, 12, 0, 720, 'Garcia Anab', ''),
    (28647861, 142, 45, 8565, 'Garcia Nata', ''),
    (37571114, 5, 30, 330, 'Gaspari Reg', ''),
    (28499481, 1849, 30, 110970, 'Gieco Maur', ''),
    (21698062, 1, 0, 60, 'Gimenez Cl', ''),
    (34904517, 478, 0, 28680, 'Gimenez Jac', ''),
    (30187481, 739, 0, 44340, 'Gimenez M', ''),
    (35175658, 16, 15, 975, 'Gimenez Va', ''),
    (34299123, 0, 0, 0, 'Girolimetto Evangelina Gisel', ''),
    (34014440, 0, 0, 0, 'Giunta Daiana Vanesa', ''),
    (39031781, 0, 0, 0, 'Godina Florencia AnahÃ­', ''),
    (37045996, 328, 30, 19710, 'Godina Mar', ''),
    (32698866, -1, 0, -60, 'Gonzalez M', ''),
    (29988235, 322, 0, 19320, 'Gonzalez M', ''),
    (34680407, 22, 0, 1320, 'Gonzalez Ro', ''),
    (30301077, 119, 15, 7155, 'Gros Mariel', ''),
    (24054406, 75, 30, 4530, 'Guevara Lil', ''),
    (27770919, 72, 0, 4320, 'Guiter Anah', ''),
    (33314323, 183, 0, 10980, 'Haller Cefer', ''),
    (92664942, 54, 0, 3240, 'Hamann Ya', ''),
    (29447378, 7, 15, 435, 'Hatt Lucian', ''),
    (29723025, 238, 0, 14280, 'Herrlein Ma', ''),
    (29447742, 0, 0, 0, 'Ibarra Valeria Yanina', ''),
    (22514235, 107, 45, 6465, 'Ilardi Cristia', ''),
    (32509479, 0, 0, 0, 'Ilardo Antonella', ''),
    (32830716, 221, 30, 13290, 'Jacob NatalÃ­', ''),
    (31678229, 39, 30, 2370, 'Jauregui Ca', ''),
    (39031828, 7, 0, 420, 'Kap Lautaro', ''),
    (34014455, 16, 30, 990, 'Leiva Matia', ''),
    (36703673, 92, 0, 5520, 'Leiva Tama', ''),
    (37382814, 94, 30, 5670, 'Lopez Anto', ''),
    (30187089, 2, 0, 120, 'Lucido Ang', ''),
    (26809281, 235, 0, 14100, 'Luna Mauri', ''),
    (26048560, 325, 0, 19500, 'Machado M', ''),
    (33919235, 80, 0, 4800, 'Mangona Ez', ''),
    (35706468, 330, 0, 19800, 'Mangona Ir', ''),
    (36103256, 204, 0, 12240, 'Manrique G', ''),
    (33497970, 8, 30, 510, 'Mariani Lili', ''),
    (29515482, 15, 30, 930, 'Martinez De', ''),
    (30782643, 0, 0, 0, 'Martinez He', ''),
    (41698478, 76, 0, 4560, 'Martinez In', ''),
    (25307486, 0, 0, 0, 'Martinez Ro', ''),
    (30164424, 11, 0, 660, 'Maydana A', ''),
    (32669213, 1, 0, 60, 'Medina Cec', ''),
    (33423852, 0, 0, 0, 'Medina Evelin Ruth', ''),
    (32114428, 462, 0, 27720, 'Medrano N', ''),
    (27813899, 22, 0, 1320, 'Meglio Mar', ''),
    (31139158, 43, 0, 2580, 'Mendez Ber', ''),
    (30829346, 2, 15, 135, 'Mendez Fac', ''),
    (37080871, 16, 0, 960, 'Mendoza Cy', ''),
    (23450276, 1, 15, 75, 'Micceli Patr', ''),
    (30322029, 104, 15, 6255, 'Milano Gab', ''),
    (34587194, 10, 30, 630, 'Mildenberg', ''),
    (32833366, 213, 0, 12780, 'Militello Ay', ''),
    (24606754, 0, 0, 0, 'Minigutti Walter Javier', ''),
    (40168270, 118, 0, 7080, 'MiÃ±o Elisa I', ''),
    (36876615, 284, 0, 17040, 'Moine Mari', ''),
    (38898064, 0, 0, 0, 'Molinas MarÃ­a Victoria', ''),
    (24230525, 59, 30, 3570, 'Monasterio', ''),
    (31017772, 451, 30, 27090, 'Monicault E', ''),
    (35559398, 92, 0, 5520, 'Morini Yani', ''),
    (22737715, 48, 0, 2880, 'Moro Vivian', ''),
    (30863539, 111, 0, 6660, 'Mubashir Y', ''),
    (35706366, 31, 30, 1890, 'Muller Dani', ''),
    (39031952, 202, 0, 12120, 'Muller Oria', ''),
    (25431975, 332, 0, 19920, 'MuÃ±oz Alan', ''),
    (32580777, 37, 0, 2220, 'MuÃ±oz Vict', ''),
    (28471458, 1, 30, 90, 'Murgado M', ''),
    (25546384, 331, 0, 19860, 'Nani Cesar', ''),
    (32831593, 37, 30, 2250, 'Natella Mau', ''),
    (33130176, 248, 45, 14925, 'Nicala Aye', ''),
    (29346760, 163, 0, 9780, 'Ocampo Ar', ''),
    (31724869, 163, 0, 9780, 'Ocampo Ev', ''),
    (30558993, 124, 0, 7440, 'Olguin Mar', ''),
    (29855584, 10, 0, 600, 'Pacifico Ilea', ''),
    (32831177, 135, 0, 8100, 'Pacifico Ver', ''),
    (38569922, 18, 0, 1080, 'Paez Aguirr', 'hora_pegada_al_nombre'),
    (29855261, 61, 15, 3675, 'Palleiro Luc', ''),
    (31232692, 317, 0, 19020, 'Paredes Car', ''),
    (27466612, -3, 30, -210, 'Passi Nadia', ''),
    (32659222, 186, 30, 11190, 'Pedroni Car', ''),
    (29620350, 20, 15, 1215, 'Peltzer Silvi', ''),
    (35442872, 54, 0, 3240, 'Perez Alexia', ''),
    (30164369, 8, 0, 480, 'Perez Ana C', ''),
    (38769500, 54, 0, 3240, 'Perez Laura', 'hora_pegada_al_nombre'),
    (32669064, 3, 30, 210, 'Perez Zacar', ''),
    (26564112, 11, 0, 660, 'Peter Romin', ''),
    (28793693, 2, 0, 120, 'PeyrÃº Maite', ''),
    (36269363, 19, 0, 1140, 'Piocampo F', ''),
    (33009479, 28, 0, 1680, 'Poissonneau', ''),
    (34904257, 338, 0, 20280, 'Prettis Mon', ''),
    (33624862, 6, 0, 360, 'Prettis Walq', ''),
    (28793577, 9, 45, 585, 'Pross Lucian', ''),
    (41268237, 0, 0, 0, 'Quintero Noelia Agustina', ''),
    (34269930, 108, 0, 6480, 'Ramos Lour', ''),
    (30152984, 1, 30, 90, 'Ramos Luci', ''),
    (29620946, 68, 15, 4095, 'Raspini Mar', ''),
    (34549510, 45, 0, 2700, 'Reato Valentina MarÃ­a', ''),
    (29971425, 182, 30, 10950, 'Recalde Ma', ''),
    (30164014, 316, 30, 18990, 'Retamar Ca', ''),
    (35440441, 32, 0, 1920, 'Retamoso L', ''),
    (25033457, 36, 0, 2160, 'Retamoso R', ''),
    (30166486, 261, 0, 15660, 'Reyes Lisan', ''),
    (33130095, 128, 15, 7695, 'Reynoso Ro', ''),
    (34587290, 34, 0, 2040, 'Riera Leone', ''),
    (31439936, 0, 0, 0, 'Riquelme Ãngel Gabriel', ''),
    (31539191, 249, 0, 14940, 'Rodriguez A', ''),
    (25861217, 148, 30, 8910, 'Rodriguez C', ''),
    (30863768, 86, 45, 5205, 'Rodriguez L', ''),
    (34680094, 179, 30, 10770, 'Rojas Javier', ''),
    (35442013, 17, 30, 1050, 'Roskopf Jan', ''),
    (25993506, 0, 0, 0, 'Saavedra Pablo Sebastian', ''),
    (30863685, 104, 30, 6270, 'Salerno Her', ''),
    (36103953, 6, 0, 360, 'Salomone A', ''),
    (28512050, 0, 0, 0, 'Salva Miriam Elisa', ''),
    (32298914, 134, 0, 8040, 'Sanchez Cri', ''),
    (28961831, 50, 0, 3000, 'Sanchez Hu', ''),
    (42581958, 42, 0, 2520, 'Sanchez Pab', ''),
    (22864738, 401, 45, 24105, 'Savino Mari', ''),
    (33502949, 67, 30, 4050, 'Schaefer An', ''),
    (32833901, 56, 45, 3405, 'Schoenfeld M', ''),
    (36269462, 388, 30, 23310, 'Scioli Arace', ''),
    (29447049, 11, 30, 690, 'Sendra Vale', ''),
    (26802916, 45, 30, 2730, 'Servin Facu', ''),
    (26802212, 14, 15, 855, 'Sione Arace', ''),
    (35448352, 31, 45, 1905, 'Sollberg Pab', ''),
    (29768791, 12, 45, 765, 'Stivanello M', ''),
    (18439780, 18, 0, 1080, 'Stoppello D', ''),
    (29855601, 124, 0, 7440, 'Suarez Meli', ''),
    (35707429, 281, 30, 16890, 'Tabares Ale', ''),
    (29620377, 2, 0, 120, 'Tarabini An', ''),
    (29620127, 246, 0, 14760, 'Tischler Alf', ''),
    (30523767, 347, 0, 20820, 'Togni Walte', ''),
    (29121310, 35, 30, 2130, 'Tortul Diego', ''),
    (36910933, 114, 0, 6840, 'Troncoso M', ''),
    (36099747, 621, 0, 37260, 'Tuma Alvar', ''),
    (32298661, 10, 30, 630, 'Varela Clau', ''),
    (28675672, 0, 0, 0, 'Varrone Evangelina Soledad', ''),
    (34299773, 81, 0, 4860, 'Varrone Roc', ''),
    (31232637, 236, 0, 14160, 'Varrone Rom', ''),
    (28676816, 493, 30, 29610, 'Vera Sergio', ''),
    (37562351, 57, 30, 3450, 'Veron Celes', ''),
    (29346371, 80, 0, 4800, 'Vilche Dieg', ''),
    (39839039, 235, 0, 14100, 'Vilche Kare', ''),
    (37080299, 153, 30, 9210, 'Villagra Jon', ''),
    (31724715, 62, 30, 3750, 'Villaverde L', ''),
    (25032930, 50, 0, 3000, 'Virgilio Mar', ''),
    (39125360, 0, 0, 0, 'Vuoto Romina', ''),
    (31103449, 113, 15, 6795, 'Yappert Me', ''),
    (26809238, 174, 15, 10455, 'Yonson Vale', ''),
    (38172499, 31, 0, 1860, 'Zanabria Da', ''),
    (27006908, 104, 45, 6285, 'Zanotta Ma', ''),
    (37289293, 25, 30, 1530, 'Zapata Laut', ''),
    (28257883, 17, 0, 1020, 'Zatti Maria', '');

-- Control previo: estas filas no se cargan porque no tienen persona/carrera actual asociada.
select t.*
from tmp_banco_inicial_francos_pdf t
left join public.persona_carreras pc on pc.dni = t.dni
where pc.dni is null
order by t.apellido_nombres;

-- Cargar banco inicial acumulado sin validar maximo diario de movimientos.
-- La tabla no permite minutos = 0; esas filas representan sin saldo inicial.
-- Si ya existe saldo_inicial vigente para una fila con 0, lo anula.
-- Si ya existe saldo_inicial vigente para una fila distinta de 0, lo actualiza.
with all_source_rows as (
  select
    t.dni,
    pc.carrera_id,
    date '2026-06-23' as fecha,
    date_trunc('month', date '2026-06-23')::date as periodo,
    t.total_minutos as minutos,
    null::text as observacion
  from tmp_banco_inicial_francos_pdf t
  join public.persona_carreras pc on pc.dni = t.dni
), current_rows as (
  select distinct on (fm.dni, fm.carrera_id)
    fm.id,
    fm.dni,
    fm.carrera_id
  from public.francos_movimientos fm
  join all_source_rows s
    on s.dni = fm.dni
   and s.carrera_id = fm.carrera_id
  where fm.motivo = 'saldo_inicial'
    and fm.anulado = false
  order by fm.dni, fm.carrera_id, fm.fecha desc, fm.id desc
), zeroed as (
  update public.francos_movimientos fm
  set anulado = true,
      usuario_modifica = 'de9e581f-7906-457d-b422-8010139ca038'::uuid,
      updated_at = now()
  from all_source_rows s
  join current_rows c
    on c.dni = s.dni
   and c.carrera_id = s.carrera_id
  where fm.id = c.id
    and s.minutos = 0
  returning fm.id
), source_rows as (
  select *
  from all_source_rows
  where minutos <> 0
), updated as (
  update public.francos_movimientos fm
  set fecha = s.fecha,
      periodo = s.periodo,
      minutos = s.minutos,
      observacion = s.observacion,
      anulado = false,
      usuario_modifica = 'de9e581f-7906-457d-b422-8010139ca038'::uuid,
      updated_at = now()
  from source_rows s
  join current_rows c
    on c.dni = s.dni
   and c.carrera_id = s.carrera_id
  where fm.id = c.id
  returning fm.id
)
insert into public.francos_movimientos (
  dni,
  carrera_id,
  fecha,
  periodo,
  minutos,
  motivo,
  observacion,
  usuario_carga
)
select
  s.dni,
  s.carrera_id,
  s.fecha,
  s.periodo,
  s.minutos,
  'saldo_inicial',
  s.observacion,
  'de9e581f-7906-457d-b422-8010139ca038'::uuid
from source_rows s
left join current_rows c
  on c.dni = s.dni
 and c.carrera_id = s.carrera_id
where c.id is null;

-- Resumen para verificar despues de cargar.
select motivo, count(*) as registros, sum(minutos) as total_minutos
from public.francos_movimientos
where motivo = 'saldo_inicial'
  and fecha = date '2026-06-23'
  and anulado = false
group by motivo;

commit;
