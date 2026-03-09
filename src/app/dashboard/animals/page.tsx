"use client";

import { useState, useMemo } from "react";
import { MOCK_ANIMALS, MOCK_FARMS, MOCK_SPECIES } from "@/data/mock";
import type { Animal as AnimalType, AnimalSex } from "@/types";

type SortKey = "name" | "farm" | "species" | "sex" | "birthDate" | "identification";
type SortDir = "asc" | "desc";

export default function AnimalsPage() {
  const [animals, setAnimals] = useState<AnimalType[]>(MOCK_ANIMALS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<AnimalType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterFarmId, setFilterFarmId] = useState<string>("");
  const [filterSpeciesId, setFilterSpeciesId] = useState<string>("");
  const [filterSex, setFilterSex] = useState<string>("");

  const [formName, setFormName] = useState("");
  const [formFarmId, setFormFarmId] = useState(MOCK_FARMS[0]?.id ?? "");
  const [formSpeciesId, setFormSpeciesId] = useState(MOCK_SPECIES[0]?.id ?? "");
  const [formSex, setFormSex] = useState<AnimalSex>("female");
  const [formBirthDate, setFormBirthDate] = useState("");
  const [formIdentification, setFormIdentification] = useState("");

  const openCreate = () => {
    setEditingAnimal(null);
    setFormName("");
    setFormFarmId(MOCK_FARMS[0]?.id ?? "");
    setFormSpeciesId(MOCK_SPECIES[0]?.id ?? "");
    setFormSex("female");
    setFormBirthDate("");
    setFormIdentification("");
    setModalOpen(true);
  };

  const openEdit = (animal: AnimalType) => {
    setEditingAnimal(animal);
    setFormName(animal.name);
    setFormFarmId(animal.farmId);
    setFormSpeciesId(animal.speciesId);
    setFormSex(animal.sex);
    setFormBirthDate(animal.birthDate || "");
    setFormIdentification(animal.identification || "");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAnimal(null);
    setFormName("");
    setFormFarmId(MOCK_FARMS[0]?.id ?? "");
    setFormSpeciesId(MOCK_SPECIES[0]?.id ?? "");
    setFormSex("female");
    setFormBirthDate("");
    setFormIdentification("");
  };

  const getFarmName = (farmId: string) =>
    MOCK_FARMS.find((f) => f.id === farmId)?.name ?? farmId;
  const getSpeciesName = (speciesId: string) =>
    MOCK_SPECIES.find((s) => s.id === speciesId)?.name ?? speciesId;

  const toggleSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (sortKey === key && d === "asc" ? "desc" : "asc"));
  };

  const filteredAndSortedAnimals = useMemo(() => {
    let list = animals.filter((a) => {
      const farmName = getFarmName(a.farmId);
      const speciesName = getSpeciesName(a.speciesId);
      const matchSearch =
        !filterSearch.trim() ||
        a.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        (a.identification ?? "").toLowerCase().includes(filterSearch.toLowerCase()) ||
        farmName.toLowerCase().includes(filterSearch.toLowerCase()) ||
        speciesName.toLowerCase().includes(filterSearch.toLowerCase());
      const matchFarm = !filterFarmId || a.farmId === filterFarmId;
      const matchSpecies = !filterSpeciesId || a.speciesId === filterSpeciesId;
      const matchSex = !filterSex || a.sex === filterSex;
      return matchSearch && matchFarm && matchSpecies && matchSex;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      if (sortKey === "farm") return dir * getFarmName(a.farmId).localeCompare(getFarmName(b.farmId));
      if (sortKey === "species") return dir * getSpeciesName(a.speciesId).localeCompare(getSpeciesName(b.speciesId));
      if (sortKey === "sex") return dir * (a.sex === b.sex ? 0 : a.sex === "male" ? 1 : -1);
      if (sortKey === "birthDate") return dir * (a.birthDate || "").localeCompare(b.birthDate || "");
      if (sortKey === "identification") return dir * (a.identification || "").localeCompare(b.identification || "");
      return 0;
    });
    return list;
  }, [animals, sortKey, sortDir, filterSearch, filterFarmId, filterSpeciesId, filterSex]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) return;

    if (editingAnimal) {
      setAnimals((prev) =>
        prev.map((a) =>
          a.id === editingAnimal.id
            ? {
                ...a,
                name,
                farmId: formFarmId,
                speciesId: formSpeciesId,
                sex: formSex,
                birthDate: formBirthDate,
                identification: formIdentification.trim(),
              }
            : a
        )
      );
    } else {
      const newAnimal: AnimalType = {
        id: `a${Date.now()}`,
        name,
        farmId: formFarmId,
        speciesId: formSpeciesId,
        sex: formSex,
        birthDate: formBirthDate,
        identification: formIdentification.trim(),
      };
      setAnimals((prev) => [...prev, newAnimal]);
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    setAnimals((prev) => prev.filter((a) => a.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Animales</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Añadir y gestionar animales. Nombre, granja, especie, sexo, fecha de nacimiento e identificación.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-agro-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-agro-700"
        >
          Añadir animal
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          placeholder="Buscar por nombre, granja, especie o identificación..."
          value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)}
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
        <select
          value={filterFarmId}
          onChange={(e) => setFilterFarmId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="">Todas las granjas</option>
          {MOCK_FARMS.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select
          value={filterSpeciesId}
          onChange={(e) => setFilterSpeciesId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="">Todas las especies</option>
          {MOCK_SPECIES.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterSex}
          onChange={(e) => setFilterSex(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="">Cualquier sexo</option>
          <option value="female">Hembra</option>
          <option value="male">Macho</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Nombre {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("farm")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Granja {sortKey === "farm" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("species")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Especie {sortKey === "species" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("sex")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Sexo {sortKey === "sex" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("birthDate")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Nacimiento {sortKey === "birthDate" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("identification")}
                    className="flex items-center gap-1 font-semibold text-slate-800 hover:text-agro-600 dark:text-slate-200 dark:hover:text-agro-400"
                  >
                    Identificación {sortKey === "identification" && (sortDir === "asc" ? "↑" : "↓")}
                  </button>
                </th>
                <th className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-600">
              {filteredAndSortedAnimals.map((animal) => (
                <tr key={animal.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {animal.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {getFarmName(animal.farmId)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {getSpeciesName(animal.speciesId)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {animal.sex === "male" ? "Macho" : "Hembra"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {animal.birthDate || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {animal.identification || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {deleteConfirm === animal.id ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">¿Eliminar?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(animal.id)}
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-500 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(null)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-600"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(animal)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(animal.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-500 dark:text-red-300 dark:hover:bg-red-900/40"
                        >
                          Eliminar
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAndSortedAnimals.length === 0 && (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            {animals.length === 0
              ? "No hay animales. Pulsa \"Añadir animal\" para crear uno."
              : "Ningún animal coincide con los filtros."}
          </p>
        )}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="animal-form-title"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800 dark:border dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="animal-form-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {editingAnimal ? "Editar animal" : "Añadir animal"}
            </h2>
            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="animal-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nombre
                </label>
                <input
                  id="animal-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Ej. Blanca"
                />
              </div>
              <div>
                <label htmlFor="animal-farm" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Granja
                </label>
                <select
                  id="animal-farm"
                  value={formFarmId}
                  onChange={(e) => setFormFarmId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  {MOCK_FARMS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="animal-species" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Especie
                </label>
                <select
                  id="animal-species"
                  value={formSpeciesId}
                  onChange={(e) => setFormSpeciesId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  {MOCK_SPECIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="animal-sex" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Sexo
                </label>
                <select
                  id="animal-sex"
                  value={formSex}
                  onChange={(e) => setFormSex(e.target.value as AnimalSex)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="female">Hembra</option>
                  <option value="male">Macho</option>
                </select>
              </div>
              <div>
                <label htmlFor="animal-birth" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Fecha de nacimiento
                </label>
                <input
                  id="animal-birth"
                  type="date"
                  value={formBirthDate}
                  onChange={(e) => setFormBirthDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="animal-id" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Identificación
                </label>
                <input
                  id="animal-id"
                  type="text"
                  value={formIdentification}
                  onChange={(e) => setFormIdentification(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-agro-500 focus:outline-none focus:ring-1 focus:ring-agro-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder="Ej. ES-V-001"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-agro-600 px-4 py-2 text-sm font-medium text-white hover:bg-agro-700"
                >
                  {editingAnimal ? "Guardar" : "Añadir"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
