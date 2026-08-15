const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Layout.js","assets/__federation_fn_import.js","assets/breadCrumb.js","assets/index2.js","assets/LocalForageService.js","assets/_commonjsHelpers.js","assets/index3.js"])))=>i.map(i=>d[i]);
import { importShared } from './__federation_fn_import.js';
import { j as jsxRuntimeExports, M as MEMISContext, d as documentText, P as PROGRAMS_FIELDS, a as PROGRAM_RULES_FIELDS, U as USER_ORGANISATION_UNITS, O as ORGANISATION_UNITS_DESCENDANTS, u as useLocation, r as renderListByUserRole, D as DataStoreProvider, b as PermissionsProvider, s as sendNotification, c as setupIonicReact, _ as __vitePreload, e as setActiveProgramCookie, B as BrowserRouter, T as ToastItem, S as SuspenseLoader } from './breadCrumb.js';
import { r as requireReactDom } from './index.js';
import dataStore from './index2.js';
import { L as LocalForageServiceInstance } from './LocalForageService.js';

var client = {};

var hasRequiredClient;

function requireClient () {
	if (hasRequiredClient) return client;
	hasRequiredClient = 1;
	var m = requireReactDom();
	{
	  client.createRoot = m.createRoot;
	  client.hydrateRoot = m.hydrateRoot;
	}
	return client;
}

var clientExports = requireClient();

const React$6 = await importShared('react');
const {useEffect: useEffect$6,useState: useState$7,useCallback: useCallback$7} = React$6;
const UserRolesProvider = ({ children }) => {
  const [userRoles, setUserRoles] = useState$7(null);
  const [user, setUser] = useState$7(null);
  const [loading, setLoading] = useState$7(true);
  const computeUserPermissions = useCallback$7((userRes, storeRes) => {
    if (!userRes || !userRes.userRoles || !storeRes || !storeRes.programs) {
      return { ...userRes, permissions: [] };
    }
    const permissions = [];
    for (const role of userRes.userRoles) {
      for (const program of storeRes.programs) {
        if (!program.sections) continue;
        for (const section of program.sections) {
          if (!section.userRoles) continue;
          const match = section.userRoles.find((r) => r.id === role.id);
          if (match && match.access?.length > 0) {
            permissions.push({
              programId: program.id,
              programName: program.name,
              sectionId: section.id,
              sectionName: section.name,
              roleId: role.id,
              roleName: role.name,
              access: match.access
            });
          }
        }
      }
    }
    return { ...userRes, permissions };
  }, []);
  const fetchUserOnline = useCallback$7(async () => {
    try {
      const userRes = await dataStore.get(
        "me?fields=id,username,name,organisationUnits[id,name,code,path,parent[id,name,code,level],level],userRoles[id,name,authorities],programs[id,name]"
      );
      const storeRes = await dataStore.get("dataStore/memis/sharingSettings");
      await LocalForageServiceInstance.setItem("userRes", userRes?.data, "user");
      await LocalForageServiceInstance.setItem("sharingSettings", storeRes?.data, "sharingSettings");
      const userObj = computeUserPermissions(userRes?.data, storeRes?.data);
      setUser(userObj);
      return userObj;
    } catch (err) {
      setUser(null);
      return null;
    }
  }, [computeUserPermissions]);
  const fetchRolesOnline = useCallback$7(async () => {
    try {
      const result = await dataStore.get("userRoles?fields=id,name");
      const roles = result?.data?.userRoles || [];
      await LocalForageServiceInstance.setItem("userRoles", roles, "userRoles");
      setUserRoles(roles);
      return roles;
    } catch (err) {
      setUserRoles([]);
      return [];
    }
  }, []);
  const loadUserOfflineFirst = useCallback$7(async () => {
    const cachedUser = await LocalForageServiceInstance.getItem("userRes", "user");
    const cachedSharing = await LocalForageServiceInstance.getItem("sharingSettings", "sharingSettings");
    if (cachedUser && cachedSharing) {
      const userObj = computeUserPermissions(cachedUser, cachedSharing);
      setUser(userObj);
      return userObj;
    }
    return fetchUserOnline();
  }, [computeUserPermissions, fetchUserOnline]);
  const loadRolesOfflineFirst = useCallback$7(async () => {
    const cached = await LocalForageServiceInstance.getItem("userRoles", "userRoles");
    if (cached) {
      setUserRoles(cached);
      return cached;
    }
    return fetchRolesOnline();
  }, [fetchRolesOnline]);
  useEffect$6(() => {
    let active = true;
    const init = async () => {
      setLoading(true);
      await Promise.all([
        loadUserOfflineFirst(),
        loadRolesOfflineFirst()
      ]);
      if (active) setLoading(false);
    };
    init();
    return () => {
      active = false;
    };
  }, [loadUserOfflineFirst, loadRolesOfflineFirst]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    MEMISContext.UserRolesContext.Provider,
    {
      value: {
        user,
        setUser,
        userRoles,
        setUserRoles,
        refreshUser: fetchUserOnline,
        refreshRoles: fetchRolesOnline,
        loading
      },
      children
    }
  );
};

const {useContext,useEffect: useEffect$5,useMemo: useMemo$6,useState: useState$6,useCallback: useCallback$6} = await importShared('react');
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
};
const isTrue = (value) => value === true || value === "true";
function MenuProvider({ children }) {
  const [activeLink, setActiveLink] = useState$6("/");
  const [navigationMenu, setNavigationMenu] = useState$6([]);
  const [menuLoaded, setMenuLoaded] = useState$6(false);
  const [menuError, setMenuError] = useState$6(null);
  const [userAccessData, setUserAccessData] = useState$6(null);
  const [userAccessLoaded, setUserAccessLoaded] = useState$6(false);
  const [programs, setPrograms] = useState$6([]);
  const [programsLoaded, setProgramsLoaded] = useState$6(false);
  const [datastoreReady, setDatastoreReady] = useState$6(false);
  const { user } = useContext(MEMISContext.UserRolesContext) || {};
  useContext(MEMISContext.PermissionContext) || {};
  const getUserAccessData = useCallback$6(async () => {
    try {
      setUserAccessLoaded(false);
      const userData = await LocalForageServiceInstance.getItem("userRes", "user");
      setUserAccessData(userData);
      setUserAccessLoaded(true);
    } catch (error) {
      console.error("Error loading user access data from IndexedDB", error);
      setUserAccessData(null);
      setUserAccessLoaded(true);
    }
  }, []);
  const getNavMenu = useCallback$6(async () => {
    setMenuLoaded(false);
    setMenuError(null);
    try {
      let menu = await LocalForageServiceInstance.getItem("dataStore", "dataStore");
      menu = menu?.navigationLayout?.configuration;
      setNavigationMenu(menu || []);
      setMenuLoaded(true);
    } catch (error) {
      console.error("Error loading navigation layout", error);
      setNavigationMenu([]);
      setMenuError(error);
      setMenuLoaded(true);
    }
  }, [user]);
  const extractBaseProgramId = (id) => {
    if (!id) return null;
    return id.split("?")[0];
  };
  const hasAccessToMenuItem = useCallback$6((item) => {
    if (!userAccessData) return false;
    const userRoleIds = (userAccessData?.userRoles || []).map((role) => role.id);
    if (item.isConsole) {
      const roles = item.accessRoles || [];
      const valid = roles.filter((r) => r?.userRoleId?.trim());
      if (valid.length === 0) return true;
      return valid.some((r) => userRoleIds.includes(r.userRoleId));
    }
    const userPrograms = userAccessData?.programs || [];
    let programIdToCheck = null;
    const isProgram = isTrue(item.isProgram);
    const isStage = isTrue(item.isStage);
    const isSection = isTrue(item.isSection);
    if (isProgram) {
      programIdToCheck = extractBaseProgramId(item.id);
    } else if (isStage || isSection) {
      programIdToCheck = item.dependentProgram;
    } else {
      programIdToCheck = extractBaseProgramId(item.id);
    }
    const hasProgramAccess = programIdToCheck ? userPrograms?.includes(programIdToCheck) : false;
    if (!hasProgramAccess) return false;
    if (item.accessRoles && Array.isArray(item.accessRoles) && item.accessRoles.length > 0) {
      const validRoles = item.accessRoles.filter((role) => {
        if (typeof role === "string") {
          return role.trim() !== "";
        }
        if (typeof role === "object" && role !== null) {
          return role?.userRoleId && role?.userRoleId.trim() !== "";
        }
        return false;
      });
      if (validRoles.length === 0) {
        return true;
      }
      const hasRoleAccess = validRoles.some((role) => {
        const roleIdToCheck = typeof role === "string" ? role : role?.userRoleId;
        return userRoleIds?.includes(roleIdToCheck);
      });
      return hasRoleAccess;
    }
    return true;
  }, [userAccessData]);
  const mergedPrograms = useMemo$6(() => {
    if (Array.isArray(navigationMenu) && navigationMenu.length > 0) {
      const programsById = new Map((programs || []).map((p) => [p.id, p]));
      return navigationMenu.map((cfg) => {
        const p = programsById?.get(cfg.id);
        if (p) {
          return { ...p, ...cfg };
        }
        return { ...cfg };
      }).filter(Boolean);
    }
    return Array.isArray(programs) ? programs : [];
  }, [navigationMenu, programs]);
  const allPrograms = useMemo$6(() => {
    const raw = Array.isArray(mergedPrograms) ? mergedPrograms : [];
    const seen = /* @__PURE__ */ new Set();
    return raw.filter((p) => {
      if (!p?.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [mergedPrograms]);
  const visiblePrograms = useMemo$6(() => {
    if (!userAccessLoaded || !userAccessData) {
      return [];
    }
    return allPrograms.filter((item) => hasAccessToMenuItem(item));
  }, [allPrograms, userAccessLoaded, userAccessData, hasAccessToMenuItem]);
  const menuModel = useMemo$6(() => {
    const groupsMap = /* @__PURE__ */ new Map();
    const ungrouped = [];
    const placed = /* @__PURE__ */ new Set();
    for (const p of visiblePrograms) {
      const name = p?.displayName || p.name || "Untitled";
      const category = p?.group || p?.groupLabel || "";
      const position = p?.position ?? p?.order ?? "";
      const order = toNum(position);
      const item = {
        type: "program",
        id: p.id,
        name,
        icon: p?.icon || documentText,
        showAddButton: p?.showAddButton,
        // prefer explicit link if provided (some nav configs use direct slugs), otherwise link by program id
        link: p?.link || `/memis/program/${p.id}`,
        programType: p?.programType,
        order,
        isProgram: isTrue(p?.isProgram),
        isStage: isTrue(p?.isStage),
        isSection: isTrue(p?.isSection),
        isConsole: isTrue(p?.isConsole),
        route: p?.route || null,
        groupLabel: category || null,
        dependentProgram: p?.dependentProgram || null,
        dependentStage: p?.dependentStage || null,
        editRoles: p?.editRoles || [],
        deleteRoles: p?.deleteRoles || [],
        accessRoles: p?.accessRoles || []
      };
      if (!category || position === "") {
        if (!placed.has(p.id)) {
          ungrouped.push(item);
          placed.add(p.id);
        }
        continue;
      }
      if (!groupsMap.has(category)) {
        groupsMap.set(category, {
          type: "group",
          label: category,
          groupOrder: Number.POSITIVE_INFINITY,
          items: [],
          _ids: /* @__PURE__ */ new Set()
        });
      }
      const group = groupsMap.get(category);
      if (!group._ids.has(p.id)) {
        group.items.push(item);
        group._ids.add(p.id);
        group.groupOrder = Math.min(group.groupOrder, order);
        placed.add(p.id);
      }
    }
    const groups = Array.from(groupsMap.values()).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    })).sort((a, b) => a.groupOrder - b.groupOrder || a.label.localeCompare(b.label)).map(({ _ids, ...g }) => g);
    ungrouped.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const flat = groups.flatMap((g) => g.items).concat(ungrouped);
    return { groups, ungrouped, flat };
  }, [visiblePrograms]);
  const menuItems = menuModel.flat;
  const refresh = useCallback$6(async () => {
    setMenuLoaded(false);
    setUserAccessLoaded(false);
    await Promise.all([getNavMenu(), getUserAccessData()]);
    setMenuLoaded(true);
    setUserAccessLoaded(true);
  }, [getNavMenu, getUserAccessData]);
  const showErrorState = userAccessLoaded && !userAccessData;
  useEffect$5(() => {
    if (!user || !datastoreReady) return;
    (async () => {
      const progr = await LocalForageServiceInstance.getItem("programs", "programs");
      setPrograms(Array.isArray(progr) ? progr : []);
      setProgramsLoaded(true);
    })();
  }, [user, datastoreReady]);
  useEffect$5(() => {
    const tryLoad = async () => {
      const cached = await LocalForageServiceInstance.getItem("dataStore", "dataStore");
      if (cached && Object.keys(cached).length > 0) {
        setDatastoreReady(true);
        getNavMenu();
        getUserAccessData();
      }
    };
    const onReady = () => {
      setDatastoreReady(true);
      getNavMenu();
      getUserAccessData();
    };
    window.addEventListener("memis:datastore-ready", onReady);
    tryLoad();
    return () => window.removeEventListener("memis:datastore-ready", onReady);
  }, []);
  const loading = !menuLoaded || !userAccessLoaded || !programsLoaded || !datastoreReady;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    MEMISContext.MenuContext.Provider,
    {
      value: {
        menuModel,
        menuItems,
        loading,
        activeLink,
        setActiveLink,
        refresh,
        menuError,
        showErrorState,
        userAccessData
      },
      children
    }
  );
}

const React$5 = await importShared('react');
const {useCallback: useCallback$5,useEffect: useEffect$4,useMemo: useMemo$5,useRef,useState: useState$5} = React$5;
function readActiveProgramIdFromCookie() {
  try {
    const rawPair = document.cookie.split(";").find((c) => c.trim().startsWith("memis_cookie="));
    if (!rawPair) return null;
    const raw = decodeURIComponent(rawPair.split("=")[1] || "");
    const obj = JSON.parse(raw);
    return obj?.activeProgramId || null;
  } catch {
    return null;
  }
}
function ProgramStageProvider({ children }) {
  const [programId, setProgramId] = useState$5(() => readActiveProgramIdFromCookie());
  const [programStages, setProgramStages] = useState$5([]);
  const [loading, setLoading] = useState$5(false);
  const [error, setError] = useState$5(null);
  const reqSeq = useRef(0);
  const fetchProgramStages = useCallback$5(async (id) => {
    if (!id) {
      setProgramStages([]);
      return [];
    }
    const mySeq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const cachedPrograms = await LocalForageServiceInstance.getItem(
        "programs",
        "programs"
      );
      const menu = await LocalForageServiceInstance.getItem(
        "dataStore",
        "dataStore"
      );
      let data = menu?.navigationLayout?.configuration;
      data = data?.find((sc) => sc?.id === id);
      if (!data?.isProgram && data?.isSetion) {
      }
      const idValue = data?.isProgram ? data?.id : data?.dependentProgram;
      const filtered = cachedPrograms?.find((program) => program?.id === idValue);
      const stages = (filtered?.programStages ?? []).sort(
        (a, b) => (a?.displayName || a?.name || "").localeCompare(b?.displayName || b?.name || "")
      );
      if (mySeq !== reqSeq?.current) return [];
      setProgramStages(stages);
      return stages;
    } catch (e) {
      if (mySeq !== reqSeq?.current) return [];
      setError(e);
      setProgramStages([]);
      return [];
    } finally {
      if (mySeq === reqSeq?.current) setLoading(false);
    }
  }, []);
  useEffect$4(() => {
    if (programId) fetchProgramStages(programId);
    else setProgramStages([]);
  }, [programId, fetchProgramStages]);
  const refresh = useCallback$5(() => {
    const id = readActiveProgramIdFromCookie();
    setProgramId(id);
    return id ? fetchProgramStages(id) : Promise.resolve([]);
  }, [fetchProgramStages]);
  const setActiveProgramIdLocal = useCallback$5(
    (id) => {
      setProgramId(id);
      return id ? fetchProgramStages(id) : Promise.resolve([]);
    },
    [fetchProgramStages]
  );
  const value = useMemo$5(
    () => ({
      programId,
      programStages,
      loading,
      error,
      refresh,
      setActiveProgramIdLocal,
      fetchProgramStages
    }),
    [programId, programStages, loading, error, refresh, setActiveProgramIdLocal, fetchProgramStages]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(MEMISContext.ProgramStageContext.Provider, { value, children });
}

const {useCallback: useCallback$4,useEffect: useEffect$3,useState: useState$4,useMemo: useMemo$4} = await importShared('react');
function ProgramProvider({ children }) {
  const [programs, setPrograms] = useState$4([]);
  const [enrollmentPrograms, setEnrollmentPrograms] = useState$4([]);
  const [loading, setLoading] = useState$4(true);
  const [programsReady, setProgramsReady] = useState$4(false);
  const [error, setError] = useState$4(null);
  const encodeFields = (fields) => encodeURIComponent(fields || "");
  const fetchProgramsFromOnline = useCallback$4(async () => {
    setLoading(true);
    setProgramsReady(false);
    try {
      const programPayload = await dataStore.get(
        `programs?fields=${encodeFields(PROGRAMS_FIELDS)}&paging=false`
      );
      const rulesPayload = await dataStore.get(
        `programRules?fields=${encodeFields(PROGRAM_RULES_FIELDS)}&paging=false`
      );
      const asArray = (p, key) => Array.isArray(p?.[key]) ? p[key] : Array.isArray(p) ? p : [];
      const programList = asArray(programPayload?.data, "programs");
      const rulesList = asArray(rulesPayload?.data, "programRules");
      await LocalForageServiceInstance.setItem("programs", programList, "programs");
      await LocalForageServiceInstance.setItem("programRules", rulesList, "programRules");
      const rulesByProgram = rulesList.reduce((acc, rule) => {
        const id = rule?.program?.id;
        if (id) (acc[id] = acc[id] || []).push(rule);
        return acc;
      }, {});
      const enriched = programList.map((p) => ({
        ...p,
        programRules: rulesByProgram[p.id] || []
      }));
      setPrograms(enriched);
      setProgramsReady(true);
      setLoading(false);
      return enriched;
    } catch (err) {
      setError(err);
      setPrograms([]);
      setProgramsReady(true);
      setLoading(false);
      return [];
    }
  }, []);
  const fetchPrograms = useCallback$4(async () => {
    setLoading(true);
    setProgramsReady(false);
    try {
      const cachedPrograms = await LocalForageServiceInstance.getItem(
        "programs",
        "programs"
      );
      const cachedRules = await LocalForageServiceInstance.getItem(
        "programRules",
        "programRules"
      );
      if (cachedPrograms && cachedRules) {
        const rulesByProgram = cachedRules.reduce((acc, rule) => {
          const id = rule?.program?.id;
          if (id) (acc[id] = acc[id] || []).push(rule);
          return acc;
        }, {});
        const enriched = cachedPrograms.map((p) => ({
          ...p,
          programRules: rulesByProgram[p.id] || []
        }));
        setPrograms(enriched);
        setProgramsReady(true);
        setLoading(false);
        return enriched;
      }
      return await fetchProgramsFromOnline();
    } catch (err) {
      setError(err);
      setPrograms([]);
      setProgramsReady(false);
      setLoading(false);
      return [];
    }
  }, [fetchProgramsFromOnline]);
  const fetchEnrollmentPrograms = useCallback$4(async () => {
    try {
      const cached = await LocalForageServiceInstance.getItem(
        "enrollmentPrograms",
        "programs"
      );
      if (cached) {
        setEnrollmentPrograms(cached);
        return cached;
      }
      const remoteData = await LocalForageServiceInstance.getItem(
        "dataStore",
        "dataStore"
      );
      const remote = remoteData?.enrollmentPrograms;
      const programs2 = remote?.programs || [];
      await LocalForageServiceInstance.setItem(
        "enrollmentPrograms",
        programs2,
        "programs"
      );
      setEnrollmentPrograms(programs2);
      return programs2;
    } catch {
      setEnrollmentPrograms([]);
      return [];
    }
  }, []);
  useEffect$3(() => {
    (async () => {
      await fetchPrograms();
      await fetchEnrollmentPrograms();
    })();
  }, []);
  const refresh = useCallback$4(() => fetchProgramsFromOnline(), [
    fetchProgramsFromOnline
  ]);
  const value = useMemo$4(
    () => ({
      programs,
      enrollmentPrograms,
      loading,
      programsReady,
      // ← NEW
      error,
      fetchPrograms,
      fetchEnrollmentPrograms,
      refresh
    }),
    [programs, enrollmentPrograms, loading, programsReady, error]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(MEMISContext.ProgramContext.Provider, { value, children });
}

const React$4 = await importShared('react');
const {useCallback: useCallback$3,useEffect: useEffect$2,useMemo: useMemo$3,useState: useState$3} = React$4;
function UserProvider({ children }) {
  const [userOrganisationUnits, setUserOrganisationUnits] = useState$3([]);
  const [loading, setLoading] = useState$3(true);
  const fetchOrgUnitsOnline = useCallback$3(async () => {
    try {
      setLoading(true);
      const root = await dataStore.get(
        `organisationUnits.json?${USER_ORGANISATION_UNITS}`
      );
      const rootId = root?.data?.organisationUnits?.sort((a, b) => b?.level - a?.level)?.pop()?.id;
      if (!rootId) {
        setUserOrganisationUnits([]);
        return [];
      }
      const descendants = await dataStore.get(
        `organisationUnits/${rootId}/descendants?${ORGANISATION_UNITS_DESCENDANTS}`
      );
      const orgUnits = (descendants?.data?.organisationUnits ?? []).sort(
        (a, b) => (a.displayName || a.name || "").localeCompare(
          b.displayName || b.name || ""
        )
      );
      const allOrgUnits = await dataStore.get(
        `organisationUnits.json?fields=id,name,code,,parent(id,name,level,code),level&paging=false`
      );
      await LocalForageServiceInstance.setItem(
        "userOrganisationUnits",
        orgUnits,
        "userOrgUnits"
      );
      await LocalForageServiceInstance.setItem(
        "organisationUnits",
        allOrgUnits?.data?.organisationUnits || [],
        "organisationUnits"
      );
      const cachedUser = await LocalForageServiceInstance.getItem("userRes", "user");
      const userOnlyOrgUnits = await dataStore.get(
        `users/${cachedUser?.id}?fields=organisationUnits[id,name,code,parent(id,name,level,code),displayName,level]`
      );
      await LocalForageServiceInstance.setItem(
        "userOnlyOrgUnits",
        userOnlyOrgUnits?.data?.organisationUnits || [],
        "userOnlyOrgUnits"
      );
      setUserOrganisationUnits(orgUnits);
      return orgUnits;
    } catch (e) {
      setUserOrganisationUnits([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect$2(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const cached = await LocalForageServiceInstance.getItem(
        "userOrganisationUnits",
        "userOrgUnits"
      );
      if (cached && mounted) {
        setUserOrganisationUnits(cached);
        setLoading(false);
        fetchOrgUnitsOnline();
        return;
      }
      await fetchOrgUnitsOnline();
    };
    load();
    return () => mounted = false;
  }, [fetchOrgUnitsOnline]);
  const value = useMemo$3(
    () => ({
      userOrganisationUnits,
      loading,
      fetchOrgUnits: fetchOrgUnitsOnline
      // manual refresh
    }),
    [userOrganisationUnits, loading, fetchOrgUnitsOnline]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(MEMISContext.UserContext.Provider, { value, children });
}

const React$3 = await importShared('react');
const {useEffect: useEffect$1,useState: useState$2,useMemo: useMemo$2,useCallback: useCallback$2} = React$3;
const DashboardProvider = ({ children }) => {
  const [dashboardConfigs, setDashboardConfigs] = useState$2([]);
  const [isLoading, setIsLoading] = useState$2(true);
  const [error, setError] = useState$2(null);
  const loadDashboardConfigurations = useCallback$2(async () => {
    setIsLoading(true);
    setError(null);
    let attempts = 0;
    const maxAttempts = 10;
    let configurations = null;
    try {
      while (!configurations && attempts < maxAttempts) {
        const response = await LocalForageServiceInstance.getItem(
          "dataStore",
          "dataStore"
        );
        configurations = response?.dashboardDataConfigs?.configurations || null;
        if (!configurations) {
          await new Promise((res) => setTimeout(res, 1500));
        }
        attempts++;
      }
      if (configurations) {
        setDashboardConfigs(configurations);
      } else {
        console.log("Dashboard configurations not found after polling.");
        setDashboardConfigs([]);
      }
    } catch (err) {
      console.error("Failed to load dashboard configurations:", err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  useEffect$1(() => {
    loadDashboardConfigurations();
  }, [loadDashboardConfigurations]);
  const value = useMemo$2(
    () => ({
      dashboardConfigs,
      isLoading,
      error,
      reload: loadDashboardConfigurations,
      setIsLoading
    }),
    [dashboardConfigs, isLoading, error, loadDashboardConfigurations]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(MEMISContext.DashboardContext.Provider, { value, children });
};

const React$2 = await importShared('react');
const {useState: useState$1,useMemo: useMemo$1,useCallback: useCallback$1} = React$2;
let _inFlightProgramId$1 = null;
const TrackedEntitiesProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState$1(false);
  const [error, setError] = useState$1(null);
  const [equipmentList, setEquipmentList] = useState$1([]);
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const [pagination, setPagination] = useState$1({
    page: 1,
    pageSize: 50,
    totalPages: 1
  });
  const [columns, setColumns] = useState$1([]);
  const getEquipmentList = useCallback$1(
    async ({ programId, options = {}, page = 1, pageSize = 50 }) => {
      if (!programId) return [];
      if (_inFlightProgramId$1 === programId) {
        return [];
      }
      _inFlightProgramId$1 = programId;
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append("program", programId);
        const filters = queryParams?.get("filters");
        const statusQuery = queryParams?.get("status");
        let parsed = null;
        parsed = filters ? JSON.parse(filters) : null;
        if (parsed) {
          const { startDate, endDate, department } = parsed;
          if (department) {
            options.orgUnit = department;
          }
          if (statusQuery && (statusQuery !== null || statusQuery !== "null")) {
            params.append("filter", `KFZ35H4ZHrk:like:${statusQuery}`);
          }
          if (startDate) params.append("updatedAfter", startDate);
          if (endDate) params.append("updatedBefore", endDate);
        }
        if (options?.startDate)
          params.append("updatedAfter", options?.startDate);
        if (options?.endDate) params.append("updatedBefore", options?.endDate);
        const fields = [
          "trackedEntity",
          "orgUnit",
          "attributes[attribute,value]",
          "enrollments[events[programStage,dataValues[dataElement,value]]]"
        ];
        if (options.filterType && options?.filterType?.trim() !== "" && options?.filterValue) {
          params.append(
            "filter",
            `${options?.filterType}:like:${options?.filterValue}`
          );
        }
        const dStore = await LocalForageServiceInstance.getItem(
          "dataStore",
          "dataStore"
        );
        const user = await LocalForageServiceInstance.getItem("userRes", "user");
        const roles = user?.userRoles.map((role) => role?.id);
        const programAttributesDisplay = dStore?.programAttributesDisplay.configuration?.find(
          (conf) => conf?.programId === programId
        );
        const defaultFilters = programAttributesDisplay?.defaultFilters?.filter(
          (filter) => filter?.roles?.some(
            (dfr) => roles?.some((role) => role === dfr?.id)
          )
        );
        if (defaultFilters?.length) {
          for (let index = 0; index < defaultFilters?.length; index++) {
            const element = defaultFilters[index];
            if (!options?.filterType || options?.filterType !== element?.element) {
              params.append(
                "filter",
                `${element?.attribute}:like:${element?.value}`
              );
            }
          }
        }
        if (options.orgUnit) {
          params.append("orgUnits", options.orgUnit);
          params.append("orgUnitMode", "DESCENDANTS");
        }
        params.append("fields", fields.join(","));
        params.append("totalPages", "true");
        params.append("pageSize", pageSize);
        params.append("page", page);
        const serial = options?.searchWithSerialNumber;
        if (typeof serial === "string" && serial.trim()) {
          const key = options?.searchKey;
          if (!key) {
            console.warn("Missing searchKey in options");
            return;
          }
          const value2 = serial.trim();
          params.append("filter", `${key}:ilike:${value2}`);
        }
        const loggedInUser = await LocalForageServiceInstance.getItem(
          "userRes",
          "user"
        );
        const useAllocated = loggedInUser.userRoles?.some(
          (role) => role?.id === "Ec6TZ5N1QeF"
        );
        let response = null;
        if (useAllocated) {
          const newParams = new URLSearchParams({
            program: programId,
            paging: false,
            fields: "trackedEntity,orgUnit,attributes,enrollments[events,program,orgUnit]"
          });
          const user2 = await LocalForageServiceInstance.getItem("userRes", "user");
          if (parsed) {
            const { startDate, endDate, department } = parsed;
            if (department) {
              options.orgUnit = department;
            }
            if (statusQuery && (statusQuery !== null || statusQuery !== "null")) {
              newParams.append("filter", `KFZ35H4ZHrk:like:${statusQuery}`);
            }
            if (startDate) newParams.append("updatedAfter", startDate);
            if (endDate) newParams.append("updatedBefore", endDate);
            if (options.filterType && options?.filterType?.trim() !== "" && options?.filterValue) {
              newParams.append(
                "filter",
                `${options?.filterType}:like:${options?.filterValue}`
              );
            }
            if (defaultFilters?.length > 0) {
              response = await renderListByUserRole({
                user: user2,
                programId,
                orgUnit: department,
                params: newParams
              });
            } else {
              response = await dataStore.get(
                `tracker/trackedEntities?${params.toString()}`
              );
            }
          } else {
            if (defaultFilters?.length > 0) {
              response = await renderListByUserRole({
                user: user2,
                programId,
                orgUnit: options?.orgUnit,
                params: newParams
              });
            } else {
              response = await dataStore.get(
                `tracker/trackedEntities?${params.toString()}`
              );
            }
          }
        } else {
          response = await dataStore.get(
            `tracker/trackedEntities?${params.toString()}`
          );
        }
        const trackedEntities = response?.data?.trackedEntities || [];
        setPagination((prev) => ({ ...prev, ...response?.data?.pager }));
        const optionSetMap = {};
        const columnsMeta = await dataStore.get(
          `programs/${programId}?fields=programTrackedEntityAttributes[trackedEntityAttribute[id,displayName,formName,optionSetValue,optionSet[options[code,name]]]]`
        );
        const programAttributes = columnsMeta?.data?.programTrackedEntityAttributes || [];
        programAttributes.forEach((attr) => {
          const a = attr.trackedEntityAttribute;
          if (a?.optionSetValue && a?.optionSet?.options) {
            optionSetMap[a.id] = {};
            a.optionSet.options.forEach((opt) => {
              optionSetMap[a.id][opt.code] = opt.name;
            });
          }
        });
        const programAttributesResult = await LocalForageServiceInstance.getItem(
          "dataStore",
          "dataStore"
        );
        const navLayout = programAttributesResult;
        const attributesResult = programAttributesResult?.programAttributesDisplay?.configuration;
        const attributes = attributesResult?.find((att) => att?.programId === programId)?.attributes || [];
        const configArray = navLayout?.navigationLayout?.configuration || [];
        const currentConfig = configArray.find((item) => item.id === programId);
        const excludeStageId = currentConfig?.excludeByStage;
        const filteredTEIs = trackedEntities.filter((tei) => {
          if (!excludeStageId) return true;
          const enrollments = tei.enrollments || [];
          return !enrollments.some(
            (enrollment) => (enrollment.events || []).some(
              (event) => event.programStage === excludeStageId
            )
          );
        });
        const transformed = filteredTEIs.map((tei) => {
          const obj = {
            trackedentity: tei.trackedEntity,
            orgUnit: tei.orgUnit
          };
          tei.attributes?.forEach((attr) => {
            const key = attr.attribute;
            if (!attributes.includes(key)) return;
            let value2 = attr.value;
            if (optionSetMap[key]) {
              value2 = optionSetMap[key][value2] ?? value2;
            }
            obj[key] = value2 === "" || value2 == null ? null : value2;
          });
          return obj;
        });
        setEquipmentList(transformed);
        const customColumns = currentConfig?.customColumns || [];
        if (customColumns.length > 0) {
          filteredTEIs.forEach((tei, index) => {
            customColumns.forEach((customCol) => {
              const attr = tei.attributes?.find(
                (a) => a.attribute === customCol.key
              );
              if (attr !== void 0) {
                transformed[index][customCol.key] = attr.value === "" || attr.value == null ? null : attr.value;
                return;
              }
              let dataValue = null;
              const enrollments = tei.enrollments || [];
              outer: for (const enrollment of enrollments) {
                for (const event of enrollment.events || []) {
                  if (customCol.programStage && event.programStage !== customCol.programStage)
                    continue;
                  const dv = event.dataValues?.find(
                    (d) => d.dataElement === customCol.key
                  );
                  if (dv !== void 0) {
                    dataValue = dv.value === "" || dv.value == null ? null : dv.value;
                    break outer;
                  }
                }
              }
              transformed[index][customCol.key] = dataValue;
            });
          });
        }
        const dynamicColumns = attributes.map((id) => {
          const meta = programAttributes.find(
            (a) => a.trackedEntityAttribute.id === id
          )?.trackedEntityAttribute;
          return {
            key: id,
            label: meta?.formName || meta?.displayName || id,
            order: 0,
            valueType: meta?.valueType || "TEXT"
          };
        });
        customColumns.forEach((customCol) => {
          const existingIdx = dynamicColumns.findIndex(
            (c) => c.key === customCol.key
          );
          const targetOrder = customCol.position === "start" ? -100 : 9999;
          if (existingIdx === -1) {
            dynamicColumns.push({
              key: customCol.key,
              label: customCol.label,
              order: targetOrder,
              valueType: "TEXT"
            });
          } else {
            dynamicColumns[existingIdx].order = targetOrder;
            if (customCol.label) {
              dynamicColumns[existingIdx].label = customCol.label;
            }
          }
        });
        dynamicColumns.sort((a, b) => a.order - b.order);
        setColumns(dynamicColumns);
        return transformed;
      } catch (e) {
        console.error("[TrackedEntities] fetch error:", e);
        setError(e);
        setEquipmentList([]);
        return [];
      } finally {
        setIsLoading(false);
        _inFlightProgramId$1 = null;
      }
    },
    []
  );
  const value = useMemo$1(
    () => ({
      equipmentList,
      columns,
      isLoading,
      error,
      reload: getEquipmentList,
      pagination,
      setPagination
    }),
    [
      equipmentList,
      columns,
      isLoading,
      error,
      getEquipmentList,
      pagination,
      setPagination
    ]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(MEMISContext.TrackedEntitiesContext.Provider, { value, children });
};

const React$1 = await importShared('react');
const {useState,useMemo,useCallback} = React$1;
let _inFlightProgramId = null;
const EventsProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventsList, setEventsList] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    totalPages: 1
  });
  const [columns, setColumns] = useState([]);
  const getEventsList = useCallback(
    async ({ programId, options = {}, page = 1, pageSize = 50 }) => {
      if (!programId) return [];
      if (_inFlightProgramId === programId) {
        return [];
      }
      _inFlightProgramId = programId;
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.append("program", programId);
        const fields = [
          "event",
          "orgUnit",
          "programStage",
          "program",
          "dataValues"
        ];
        if (Array.isArray(options?.filters) && options?.filters?.length > 0) {
          for (let index = 0; index < options?.filters?.length; index++) {
            const element = options?.filters[index];
            params.append("filter", `${element?.id}:like:${element?.value}`);
          }
        }
        const dStore = await LocalForageServiceInstance.getItem(
          "dataStore",
          "dataStore"
        );
        const user = await LocalForageServiceInstance.getItem("userRes", "user");
        const roles = user?.userRoles.map((role) => role?.id);
        const programAttributesDisplay = dStore?.programAttributesDisplay.configuration?.find(
          (conf) => conf?.programId === programId
        );
        const defaultFilters = programAttributesDisplay?.defaultFilters?.filter(
          (filter) => filter?.roles?.some(
            (dfr) => roles?.some((role) => role === dfr?.id)
          )
        );
        const sortedUserOrgs = [...user?.organisationUnits || []].sort(
          (a, b) => b?.level - a?.level
        );
        const wardOuId = sortedUserOrgs.length > 1 ? sortedUserOrgs[0]?.id : null;
        const userWardFilters = (defaultFilters || []).filter(
          (f) => f?.value === "USER_WARD"
        );
        const regularFilters = (defaultFilters || []).filter(
          (f) => f?.value !== "USER_WARD"
        );
        for (const element of regularFilters) {
          if (!options?.filterType || options?.filterType !== element?.element) {
            params.append(
              "filter",
              `${element?.attribute}:like:${element?.value}`
            );
          }
        }
        if (options?.orgUnit) {
          params.append("orgUnit", options?.orgUnit);
          params.append("orgUnitMode", "DESCENDANTS");
        }
        params.append("fields", fields.join(","));
        params.append("totalPages", "true");
        params.append("pageSize", pageSize);
        params.append("page", page);
        const serial = options?.searchWithSerialNumber;
        if (typeof serial === "string" && serial.trim()) {
          const key = options?.searchKey;
          if (!key) {
            console.warn("[EventsProvider] Missing searchKey in options");
            return [];
          }
          params.append("filter", `${key}:ilike:${serial.trim()}`);
        }
        let events = [];
        if (userWardFilters.length > 1 && wardOuId) {
          const orParams = new URLSearchParams(params);
          orParams.delete("page");
          orParams.delete("pageSize");
          orParams.delete("totalPages");
          orParams.append("paging", "false");
          const fetches = userWardFilters.map(async (f) => {
            const p = new URLSearchParams(orParams);
            p.append("filter", `${f?.attribute}:like:${wardOuId}`);
            return dataStore.get(`tracker/events?${p.toString()}`).then((r) => r?.data?.events || []).catch(() => []);
          });
          const results = await Promise.all(fetches);
          const seen = /* @__PURE__ */ new Set();
          for (const batch of results) {
            for (const ev of batch) {
              if (!seen.has(ev.event)) {
                seen.add(ev.event);
                events.push(ev);
              }
            }
          }
          setPagination({ page: 1, pageCount: 1, pageSize: events.length, total: events.length });
        } else {
          if (userWardFilters.length === 1 && wardOuId) {
            params.append(
              "filter",
              `${userWardFilters[0]?.attribute}:like:${wardOuId}`
            );
          }
          const response = await dataStore.get(
            `tracker/events?${params.toString()}`
          );
          events = response?.data?.events || [];
          setPagination((prev) => ({ ...prev, ...response?.data?.pager }));
        }
        const optionSetMap = {};
        const columnsMeta = await dataStore.get(
          `programs/${programId}?fields=name,id,programStages[id,name,displayName,programStageSections[id,name,programStage[id,name],formName,dataElements[id,name,sortOrder,formName,domainType,valueType,optionSetValue,optionSet[id,name,code,options[id,name,code]]]],programStageDataElements[id,compulsory,programStage[id],dataElement[id,name,code,domainType,formName,valueType,optionSetValue,optionSet[id,name,code,options[id,name,code]],attributeValues[value,attribute[id,name]]]]]`
        );
        const programAttributes = columnsMeta?.data?.programStages?.[0]?.programStageDataElements || [];
        programAttributes.forEach((attr) => {
          const a = attr.dataElement;
          if (a?.optionSetValue && a?.optionSet?.options) {
            optionSetMap[a.id] = {};
            a.optionSet.options.forEach((opt) => {
              optionSetMap[a.id][opt.code] = opt.name;
            });
          }
        });
        const programAttributesResult = await LocalForageServiceInstance.getItem(
          "dataStore",
          "dataStore"
        );
        const attributesResult = programAttributesResult?.programAttributesDisplay?.configuration;
        const attributes = attributesResult?.find((att) => att?.programId === programId)?.attributes || [];
        const transformed = events.map((event) => {
          const obj = {
            event: event.event,
            orgUnit: event.orgUnit
          };
          event.dataValues?.forEach((de) => {
            const key = de.dataElement;
            if (!attributes.includes(key)) return;
            let value2 = de.value;
            if (optionSetMap[key]) {
              value2 = optionSetMap[key][value2] ?? value2;
            }
            obj[key] = value2 === "" || value2 == null ? null : value2 === "true" || value2 === true ? "Yes" : value2 === "false" || value2 === false ? "No" : value2;
          });
          return obj;
        });
        setEventsList(transformed);
        const dynamicColumns = attributes.map((id) => {
          const meta = programAttributes.find(
            (a) => a.dataElement.id === id
          )?.dataElement;
          return {
            key: id,
            label: meta?.formName || meta?.displayName || id,
            valueType: meta?.valueType || "TEXT"
          };
        });
        setColumns(dynamicColumns);
        return transformed;
      } catch (e) {
        console.error("[EventsProvider] fetch error:", e);
        setError(e);
        setEventsList([]);
        return [];
      } finally {
        setIsLoading(false);
        _inFlightProgramId = null;
      }
    },
    []
  );
  const value = useMemo(
    () => ({
      eventsList,
      columns,
      isLoading,
      error,
      reload: getEventsList,
      pagination,
      setPagination
    }),
    [
      eventsList,
      columns,
      isLoading,
      error,
      getEventsList,
      pagination,
      setPagination
    ]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(MEMISContext.EventsContext.Provider, { value, children });
};

await importShared('react');
const providers = [
  DataStoreProvider,
  // 0. FIRST: Load DataStore configs before everything
  UserProvider,
  // 1. user base
  UserRolesProvider,
  // 2. roles from user
  PermissionsProvider,
  // 3. permissions from user + roles
  ProgramProvider,
  // 4. requires user + permissions
  ProgramStageProvider,
  // 5. requires program
  DashboardProvider,
  // 6. requires data store configs
  MenuProvider,
  // 6. LAST: depends on user + roles + permissions + programs
  TrackedEntitiesProvider,
  EventsProvider
];
function ProviderController({ children }) {
  return providers.reduceRight(
    (acc, Provider) => /* @__PURE__ */ jsxRuntimeExports.jsx(Provider, { children: acc }),
    children
  );
}

// src/utils/reminderDaemon.js
// One-file reminders engine with debug + tracker/events fallback.
// DataStore key: dataStore/memis/remindersConfig
// Public console API: MEMIS_REMINDERS.{start,stop,tickOnce,preview,debugProbe,listKeys,readDoc}


const REMINDERS_KEY_PATH = "dataStore/memis/remindersConfig";
const POLL_EVERY_MS = 15 * 60 * 1000;
const DEDUP_TTL_MS = 24 * 60 * 60 * 1000;

const DEDUP_STORAGE_KEY = "memis_reminder_dedup_v1";
const EVENTS_ENDPOINT_CACHE_KEY = "memis_events_endpoint_v4"; // endpoint cache
const OUMODE_CACHE_KEY = "memis_events_oumode_v1";           // ouMode cache

let _timer = null;
let _running = false;

// ---------- utils ----------
const pad2 = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + Number(n)); return d; };
const normalizeOp = (op) => ({ DAYS_UNTIL_EQ: "daysUntilEq" }[String(op)] || String(op));
const isDebugOn = () => { try { return localStorage.getItem("memis_reminders_debug") === "true"; } catch { return false; } };

// ---------- dedup ----------
function _readDedup() {
    try {
        const raw = localStorage.getItem(DEDUP_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        const now = Date.now();
        const pruned = {};
        for (const [k, ts] of Object.entries(parsed)) if (now - Number(ts) < DEDUP_TTL_MS) pruned[k] = ts;
        if (JSON.stringify(pruned) !== JSON.stringify(parsed)) localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(pruned));
        return pruned;
    } catch { return {}; }
}
function _writeDedup(m) { try { localStorage.setItem(DEDUP_STORAGE_KEY, JSON.stringify(m)); } catch { } }
const _ddKey = (ruleId, eventId, iso) => `${ruleId}:${eventId}:${iso}`;
const isDeduped = (ruleId, eventId, iso) => !!_readDedup()[_ddKey(ruleId, eventId, iso)];
function markDeduped(ruleId, eventId, iso) { const m = _readDedup(); m[_ddKey(ruleId, eventId, iso)] = Date.now(); _writeDedup(m); }

// ---------- datastore (single key; single-doc or map) ----------
async function readRulesIndex() {
    let raw; try { raw = await dataStore.get(REMINDERS_KEY_PATH); } catch { raw = null; }
    if (!raw) return [];

    // A) single-doc
    if (typeof raw === "object" && raw.programId && Array.isArray(raw.rules)) {
        return [{ pid: String(raw.programId), doc: raw }];
    }
    // B) map-of-docs
    if (typeof raw === "object") {
        const out = [];
        for (const [pid, doc] of Object.entries(raw)) {
            if (doc && typeof doc === "object" && Array.isArray(doc.rules)) out.push({ pid, doc });
        }
        return out;
    }
    return [];
}
async function listRuleKeys() { const idx = await readRulesIndex(); return idx.map((x) => x.pid); }
async function getRulesDoc(pid) { const idx = await readRulesIndex(); const hit = idx.find((x) => x.pid === pid); return hit ? hit.doc : null; }

// ---------- endpoint + ouMode resolver (tries API + plain + versioned + tracker) ----------
function getCachedOuMode() { try { return localStorage.getItem(OUMODE_CACHE_KEY) || "ACCESSIBLE"; } catch { return "ACCESSIBLE"; } }
function setCachedOuMode(v) { try { localStorage.setItem(OUMODE_CACHE_KEY, v); } catch { } }

function normalizeEventsArray(res) {
    if (Array.isArray(res?.events)) return res.events;     // classic
    if (Array.isArray(res?.instances)) return res.instances; // some tracker shapes
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res)) return res;
    return null;
}

async function resolveEventsEndpoint() {
    // honor pinned/manual override
    try { const pinned = localStorage.getItem(EVENTS_ENDPOINT_CACHE_KEY); if (pinned) return pinned; } catch { }

    // probe helper (200 + object payload is enough)
    async function probe(ep) {
        try {
            const res = await dataStore.get(`${ep}?skipPaging=true&pageSize=1&fields=event`);
            return !!(res && typeof res === "object");
        } catch { return false; }
    }

    // A) unversioned with /api
    const apiUnversioned = ["tracker/events", "tracker/events.json"];
    // B) unversioned plain (no /api)
    const plainUnversioned = ["tracker/events", "tracker/events.json"];

    // C) versioned candidates (with & without /api)
    let version = null;
    try {
        const info = await dataStore.get("system/info");
        if (info) {
            if (typeof info.contextPath === "string") {
                const m = info.contextPath.match(/\/api\/(\d+)/);
                if (m) version = m[1];
            }
            if (!version && typeof info.version === "string") { const m = info.version.match(/2\.(\d+)/); if (m) version = m[1]; }
        }
    } catch { /* may not exist on this origin */ }

    // const majors = version ? [version] : ["42", "41", "40", "39", "38", "37", "36", "35", "34", "33", "32", "31", "30", "29"];
    const apiVersioned = [
        `tracker/events`, `tracker/events.json`,
    ];
    const plainVersioned = [
        `tracker/events`, `tracker/events.json`,
    ];

    const candidates = [
        ...apiUnversioned,
        ...plainUnversioned,
        ...apiVersioned,
        ...plainVersioned,
    ];

    for (const ep of candidates) {
        if (await probe(ep)) {
            localStorage.setItem(EVENTS_ENDPOINT_CACHE_KEY, ep);
            if (isDebugOn()) console.info("[MEMIS] resolved events endpoint:", ep);
            return ep;
        }
    }

    // last resort: plain classic
    localStorage.setItem(EVENTS_ENDPOINT_CACHE_KEY, "tracker/events.json");
    return "tracker/events.json";
}

async function fetchEventsRaw(endpoint, params) {
    const tried = [];
    for (const ouMode of [getCachedOuMode(), "ALL"]) {
        params.set("ouMode", ouMode);
        const finalUrl = `${endpoint}?${params.toString()}`;
        tried.push({ url: finalUrl, ouMode });
        try {
            const res = await dataStore.get(finalUrl);
            const arr = normalizeEventsArray(res);
            if (arr !== null) {
                setCachedOuMode(ouMode);
                return { ok: true, events: arr, tried };
            }
        } catch {
            // keep trying
        }
    }
    return { ok: false, events: [], tried };
}

// ---------- fetchers ----------
async function fetchEventsByDEEqDate({ programId, stageId, dataElementId, targetISO }) {
    const endpoint = await resolveEventsEndpoint();
    const params = new URLSearchParams({
        program: programId,
        programStage: stageId,
        skipPaging: "true",
        fields: "event,orgUnit,trackedEntity,occurredAt,eventDate,program,programStage",
    });
    params.append("filter", `${dataElementId}:EQ:${targetISO}`);

    const out = await fetchEventsRaw(endpoint, params);
    if (!out.ok) {
        console.warn("[MEMIS] events fetch failed; tried:", out.tried);
        return [];
    }
    return out.events || [];
}

// ---------- rule evaluation ----------
async function collectMatchesForRule(rule, programId) {
    const logic = (rule.logic || "ALL").toUpperCase();
    const stageId = rule.stageId; if (!stageId) return [];
    let unionRows = [];
    let intersectionIds = null;
    let lastBatchById = new Map();

    for (const cond of (rule.when || [])) {
        const op = normalizeOp(cond.op);
        if (cond.type !== "dataElement" || op !== "daysUntilEq") continue;

        const targetISO = toYMD(addDays(new Date(), Number(cond.value)));
        const batch = await fetchEventsByDEEqDate({ programId, stageId, dataElementId: cond.dataElementId, targetISO });
        const enriched = batch.map((e) => ({ ...e, _targetISO: targetISO, _deMatched: cond.dataElementId }));

        if (logic === "ANY") {
            unionRows.push(...enriched);
        } else {
            const ids = new Set(enriched.map((x) => x.event));
            intersectionIds = intersectionIds ? new Set([...intersectionIds].filter((id) => ids.has(id))) : ids;
            lastBatchById = new Map(enriched.map((x) => [x.event, x]));
        }
    }

    if (logic === "ANY") {
        const byId = new Map();
        for (const row of unionRows) if (!byId.has(row.event)) byId.set(row.event, row);
        return [...byId.values()];
    }
    if (logic === "ALL" && intersectionIds) {
        const out = [];
        for (const id of intersectionIds) {
            const row = lastBatchById.get(id);
            if (row) out.push(row);
        }
        return out;
    }
    return [];
}

function* uniqueByEventId(rows) {
    const seen = new Set();
    for (const r of rows) {
        if (!r?.event) continue;
        if (seen.has(r.event)) continue;
        seen.add(r.event);
        yield r;
    }
}

// ---------- dispatch ----------
async function dispatchMatches(rule, programId, programName, rows) {
    if (!rows.length) { if (isDebugOn()) console.info(`[REMINDERS][${rule.id}] no matches`); return; }

    if (isDebugOn()) {
        console.groupCollapsed(`%c[REMINDERS]%c ${rule.id} — ${rows.length} match(es)`,
            "color:#7c3aed;font-weight:600", "color:inherit");
        console.table(rows.map((r) => ({
            event: r.event,
            orgUnit: r.orgUnit,
            trackedEntity: r.trackedEntity || "",
            targetISO: r._targetISO,
            matchedDE: r._deMatched,
        })));
    }

    const rec = rule.recipients || {};
    const receiverType = rec.receiverType || "USER_ROLE_ONLY";
    const userRoleIds = Array.isArray(rec.userRoleIds) ? rec.userRoleIds : [];
    const orgUnitLevel = rec.orgUnitLevel ?? 2;
    const message = rule?.template?.body || rule?.template?.title || rule.id || "Reminder";

    for (const row of uniqueByEventId(rows)) {
        const targetISO = row._targetISO || "NA";
        if (isDeduped(rule.id, row.event, targetISO)) {
            if (isDebugOn()) console.info(`[REMINDERS][${rule.id}] skip duplicate event=${row.event} date=${targetISO}`);
            continue;
        }

        if (receiverType === "USER_ROLE_ONLY" && userRoleIds.length) {
            for (const roleId of userRoleIds) {
                const payload = {
                    receiverType: "USER_ROLE_ONLY",
                    userRoleId: roleId,
                    orgUnitLevel,
                    message,
                    programId,
                    programName: programName,
                };

                if (isDebugOn()) {
                    console.log("[REMINDERS] sendNotification payload", {
                        payload,
                        orgUnit: row.orgUnit,
                        trackedEntity: row.trackedEntity || null,
                        program: { id: programId, name: programName },
                        eventId: row.event,
                        ruleId: rule.id,
                        targetISO,
                    });
                }

                await sendNotification(
                    payload,
                    row.orgUnit,
                    row.trackedEntity || null,
                    { id: programId, name: programName },
                    null,
                    "create",
                    null
                );
            }
        }

        markDeduped(rule.id, row.event, targetISO);
    }

    if (isDebugOn()) console.groupEnd();
}

// ---------- main tick ----------
async function tickOnce() {
    const index = await readRulesIndex();
    for (const { pid, doc } of index) {
        if (!doc?.rules?.length) continue;
        const programId = doc.programId || pid;
        const programName = doc.programName || "Program";
        const rules = (doc.rules || []).filter((r) => r?.enabled);

        for (const rule of rules) {
            if ((rule.scope || "event") !== "event") continue;
            const matches = await collectMatchesForRule(rule, programId);
            await dispatchMatches(rule, programId, programName, matches);
        }
    }
}

// ---------- exports + window helpers ----------
function startReminderDaemon() {
    if (_running) return;
    _running = true;
    tickOnce().catch((e) => console.error("reminderDaemon initial tick error", e));
    _timer = setInterval(() => { tickOnce().catch((e) => console.error("reminderDaemon tick error", e)); }, POLL_EVERY_MS);
}
function stopReminderDaemon() { if (_timer) clearInterval(_timer); _timer = null; _running = false; }
async function __reminderTickOnceDebug() { return tickOnce(); }
async function __previewOnce(programIdFilter = null) {
    const index = await readRulesIndex();
    for (const { pid, doc } of index) {
        if (programIdFilter && pid !== programIdFilter) continue;
        if (!doc?.rules?.length) continue;
        const programId = doc.programId || pid;
        const programName = doc.programName || "Program";
        const rules = (doc.rules || []).filter((r) => r?.enabled);
        for (const rule of rules) {
            if ((rule.scope || "event") !== "event") continue;
            const matches = await collectMatchesForRule(rule, programId);
            console.groupCollapsed(`%c[REMINDERS:PREVIEW]%c ${rule.id} — ${matches.length} match(es)`,
                "color:#0891b2;font-weight:600", "color:inherit");
            console.log("program:", { id: programId, name: programName });
            console.log("rule:", rule);
            console.table(matches.map((r) => ({
                event: r.event,
                orgUnit: r.orgUnit,
                trackedEntity: r.trackedEntity || "",
                targetISO: r._targetISO,
                matchedDE: r._deMatched,
            })));
            console.groupEnd();
        }
    }
}
async function __debugProbe(programId, stageId, dataElementId) {
    localStorage.removeItem(EVENTS_ENDPOINT_CACHE_KEY);
    localStorage.removeItem(OUMODE_CACHE_KEY);

    const endpoint = await resolveEventsEndpoint();
    console.log("[MEMIS DEBUG] resolved endpoint:", endpoint);

    const todayISO = toYMD(new Date());
    const params = new URLSearchParams({
        program: programId,
        programStage: stageId,
        skipPaging: "true",
        fields: "event",
    });
    params.append("filter", `${dataElementId}:EQ:${todayISO}`);

    const out = await fetchEventsRaw(endpoint, params);
    console.log("[MEMIS DEBUG] tries:", out.tried);
    if (out.ok) console.log("[MEMIS DEBUG] OK, events length:", out.events.length);
    else console.warn("[MEMIS DEBUG] FAILED to fetch events");
    return out;
}

if (typeof window !== "undefined") {
    const w = window;
    w.MEMIS_REMINDERS = {
        ...(w.MEMIS_REMINDERS || {}),
        start: startReminderDaemon,
        stop: stopReminderDaemon,
        tickOnce: __reminderTickOnceDebug,
        preview: __previewOnce,
        debugProbe: __debugProbe,
        listKeys: async () => listRuleKeys(),
        readDoc: async (pid) => getRulesDoc(pid),
    };
    // eslint-disable-next-line no-console
    console.info("[MEMIS] Helpers ready: MEMIS_REMINDERS.{start,stop,tickOnce,preview,debugProbe,listKeys,readDoc}");
    try {
        if (localStorage.getItem("memis_reminders_autostart") === "true") {
            startReminderDaemon();
            console.info("[MEMIS] Reminder daemon autostarted");
        }
    } catch { }
}

const {useEffect,Suspense,lazy} = await importShared('react');
setupIonicReact();
const Layout = lazy(() => __vitePreload(() => import('./Layout.js').then(n => n.L),true              ?__vite__mapDeps([0,1,2,3,4,5,6]):void 0));
function App() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("JSESSIONID");
    const uqn = params.get("uqn");
    const uqp = params.get("uqp");
    if (session) {
      const jsessionId = session.includes("=") ? session.split("=")[1] : session;
      setActiveProgramCookie({ data: jsessionId }, "JSESSIONID");
      setActiveProgramCookie({ data: uqn }, "UQN");
      setActiveProgramCookie({ data: uqp }, "UQP");
      const url = new URL(window.location);
      url.searchParams.delete("JSESSIONID");
      url.searchParams.delete("uqn");
      url.searchParams.delete("uqp");
      window.history.replaceState({}, "", url);
    }
    const daemonTimer = setTimeout(() => {
      startReminderDaemon();
    }, 1e4);
    return () => {
      clearTimeout(daemonTimer);
      stopReminderDaemon();
    };
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(BrowserRouter, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ToastItem, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Suspense, { fallback: /* @__PURE__ */ jsxRuntimeExports.jsx(SuspenseLoader, {}), children: /* @__PURE__ */ jsxRuntimeExports.jsx(ProviderController, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Layout, {}) }) })
  ] }) });
}

const React = await importShared('react');
const mount = (el, props) => {
  console.log("Remote: Mounting React app into Shell...");
  window.__MEMIS_EMBEDDED__ = true;
  const root = clientExports.createRoot(el);
  root.render(
    /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, { ...props }) })
  );
  return () => {
    console.log("Remote: Unmounting React app...");
    delete window.__MEMIS_EMBEDDED__;
    setTimeout(() => {
      root.unmount();
    }, 0);
  };
};

export { mount };
