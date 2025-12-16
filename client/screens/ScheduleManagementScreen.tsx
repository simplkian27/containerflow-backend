import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LoadingScreen } from "@/components/LoadingScreen";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BorderRadius, IndustrialDesign } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, buildApiUrl } from "@/lib/query-client";

interface Stand {
  id: string;
  identifier: string;
  stationId: string;
}

interface Station {
  id: string;
  name: string;
}

interface TaskSchedule {
  id: string;
  name: string;
  isActive: boolean;
  standId: string;
  stationId: string | null;
  ruleType: "DAILY" | "WEEKLY" | "INTERVAL";
  timeLocal: string;
  weekdays: number[] | null;
  everyNDays: number | null;
  startDate: string | null;
  timezone: string;
  createDaysAhead: number;
  createdAt: string;
  stand?: Stand;
  station?: Station;
}

interface PreviewDate {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
}

const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_FULL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

export default function ScheduleManagementScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TaskSchedule | null>(null);
  const [previewScheduleId, setPreviewScheduleId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    standId: "",
    ruleType: "DAILY" as "DAILY" | "WEEKLY" | "INTERVAL",
    timeLocal: "06:00",
    weekdays: [] as number[],
    everyNDays: 7,
    startDate: "",
    createDaysAhead: 7,
  });

  const [taskFormData, setTaskFormData] = useState({
    title: "",
    standId: "",
    description: "",
    priority: "NORMAL" as "LOW" | "NORMAL" | "HIGH" | "URGENT",
    scheduledFor: "",
  });

  const { data: schedules = [], isLoading, refetch, isRefetching } = useQuery<TaskSchedule[]>({
    queryKey: ["/api/admin/schedules"],
  });

  const { data: stands = [] } = useQuery<Stand[]>({
    queryKey: ["/api/automotive/stands"],
  });

  const { data: previewDates, isLoading: isLoadingPreview } = useQuery<PreviewDate[]>({
    queryKey: ["/api/admin/schedules", previewScheduleId, "preview"],
    enabled: !!previewScheduleId,
    queryFn: async () => {
      const url = buildApiUrl(`/admin/schedules/${previewScheduleId}/preview?days=14`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch preview");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/schedules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      setShowModal(false);
      resetForm();
    },
    onError: (error: Error) => {
      Alert.alert("Fehler", error.message || "Zeitplan konnte nicht erstellt werden");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest("PATCH", `/api/admin/schedules/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      setShowModal(false);
      setEditingSchedule(null);
      resetForm();
    },
    onError: (error: Error) => {
      Alert.alert("Fehler", error.message || "Zeitplan konnte nicht aktualisiert werden");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/schedules/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
    },
    onError: (error: Error) => {
      Alert.alert("Fehler", error.message || "Zeitplan konnte nicht gelöscht werden");
    },
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/schedules/${id}/run`);
      return res.json() as Promise<{ tasksCreated: number }>;
    },
    onSuccess: (data) => {
      Alert.alert("Erfolg", `${data.tasksCreated} Aufgabe(n) erstellt`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
    },
    onError: (error: Error) => {
      Alert.alert("Fehler", error.message || "Zeitplan konnte nicht ausgeführt werden");
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof taskFormData) => {
      const res = await apiRequest("POST", "/api/admin/tasks", {
        title: data.title,
        standId: data.standId,
        description: data.description || undefined,
        priority: data.priority,
        scheduledFor: data.scheduledFor || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      Alert.alert("Erfolg", "Aufgabe wurde erstellt");
      queryClient.invalidateQueries({ queryKey: ["/api/automotive/tasks"] });
      setShowTaskModal(false);
      resetTaskForm();
    },
    onError: (error: Error) => {
      Alert.alert("Fehler", error.message || "Aufgabe konnte nicht erstellt werden");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      standId: "",
      ruleType: "DAILY",
      timeLocal: "06:00",
      weekdays: [],
      everyNDays: 7,
      startDate: new Date().toISOString().split("T")[0],
      createDaysAhead: 7,
    });
  };

  const resetTaskForm = () => {
    setTaskFormData({
      title: "",
      standId: "",
      description: "",
      priority: "NORMAL",
      scheduledFor: "",
    });
  };

  const openTaskModal = () => {
    resetTaskForm();
    setShowTaskModal(true);
  };

  const handleTaskSubmit = () => {
    if (!taskFormData.title.trim()) {
      Alert.alert("Fehler", "Bitte geben Sie einen Titel ein");
      return;
    }
    if (!taskFormData.standId) {
      Alert.alert("Fehler", "Bitte wählen Sie einen Stand aus");
      return;
    }
    createTaskMutation.mutate(taskFormData);
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "LOW": return "Niedrig";
      case "NORMAL": return "Normal";
      case "HIGH": return "Hoch";
      case "URGENT": return "Dringend";
      default: return priority;
    }
  };

  const openCreateModal = () => {
    resetForm();
    setEditingSchedule(null);
    setShowModal(true);
  };

  const openEditModal = (schedule: TaskSchedule) => {
    setFormData({
      name: schedule.name,
      standId: schedule.standId,
      ruleType: schedule.ruleType,
      timeLocal: schedule.timeLocal,
      weekdays: schedule.weekdays || [],
      everyNDays: schedule.everyNDays || 7,
      startDate: schedule.startDate || new Date().toISOString().split("T")[0],
      createDaysAhead: schedule.createDaysAhead,
    });
    setEditingSchedule(schedule);
    setShowModal(true);
  };

  const openPreview = (scheduleId: string) => {
    setPreviewScheduleId(scheduleId);
    setShowPreviewModal(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      Alert.alert("Fehler", "Bitte geben Sie einen Namen ein");
      return;
    }
    if (!formData.standId) {
      Alert.alert("Fehler", "Bitte wählen Sie einen Stand aus");
      return;
    }
    if (formData.ruleType === "WEEKLY" && formData.weekdays.length === 0) {
      Alert.alert("Fehler", "Bitte wählen Sie mindestens einen Wochentag aus");
      return;
    }

    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (schedule: TaskSchedule) => {
    if (Platform.OS === "web") {
      if (confirm(`Zeitplan "${schedule.name}" wirklich löschen?`)) {
        deleteMutation.mutate(schedule.id);
      }
    } else {
      Alert.alert(
        "Zeitplan löschen",
        `Zeitplan "${schedule.name}" wirklich löschen?`,
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Löschen", style: "destructive", onPress: () => deleteMutation.mutate(schedule.id) },
        ]
      );
    }
  };

  const handleRun = (schedule: TaskSchedule) => {
    if (Platform.OS === "web") {
      if (confirm(`Zeitplan "${schedule.name}" jetzt ausführen?`)) {
        runMutation.mutate(schedule.id);
      }
    } else {
      Alert.alert(
        "Zeitplan ausführen",
        `Zeitplan "${schedule.name}" jetzt ausführen und Aufgaben erstellen?`,
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Ausführen", onPress: () => runMutation.mutate(schedule.id) },
        ]
      );
    }
  };

  const toggleWeekday = (day: number) => {
    setFormData(prev => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter(d => d !== day)
        : [...prev.weekdays, day].sort(),
    }));
  };

  const getRuleTypeLabel = (ruleType: string) => {
    switch (ruleType) {
      case "DAILY": return "Täglich";
      case "WEEKLY": return "Wöchentlich";
      case "INTERVAL": return "Intervall";
      default: return ruleType;
    }
  };

  const getScheduleDescription = (schedule: TaskSchedule) => {
    switch (schedule.ruleType) {
      case "DAILY":
        return `Täglich um ${schedule.timeLocal}`;
      case "WEEKLY":
        const days = (schedule.weekdays || []).map(d => WEEKDAY_NAMES[d - 1]).join(", ");
        return `${days} um ${schedule.timeLocal}`;
      case "INTERVAL":
        return `Alle ${schedule.everyNDays} Tage um ${schedule.timeLocal}`;
      default:
        return schedule.timeLocal;
    }
  };

  const renderScheduleItem = ({ item }: { item: TaskSchedule }) => (
    <Card style={{ backgroundColor: theme.cardSurface, borderColor: theme.cardBorder }}>
      <View style={styles.scheduleHeader}>
        <View style={styles.scheduleTitleRow}>
          <Feather name="clock" size={20} color={theme.primary} />
          <ThemedText type="bodyBold" numberOfLines={1} ellipsizeMode="tail" style={{ color: theme.text, marginLeft: Spacing.sm, flex: 1 }}>
            {item.name}
          </ThemedText>
          <StatusBadge
            status={item.isActive ? "success" : "warning"}
            size="small"
            label={item.isActive ? "Aktiv" : "Inaktiv"}
          />
        </View>
      </View>

      <View style={styles.scheduleDetails}>
        <View style={styles.detailRow}>
          <Feather name="calendar" size={14} color={theme.textSecondary} />
          <ThemedText type="small" numberOfLines={1} ellipsizeMode="tail" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
            {getScheduleDescription(item)}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={14} color={theme.textSecondary} />
          <ThemedText type="small" numberOfLines={1} ellipsizeMode="tail" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
            Stand: {item.stand?.identifier || item.standId}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <Feather name="layers" size={14} color={theme.textSecondary} />
          <ThemedText type="small" numberOfLines={1} ellipsizeMode="tail" style={{ color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }}>
            {getRuleTypeLabel(item.ruleType)} | {item.createDaysAhead} Tage im Voraus
          </ThemedText>
        </View>
      </View>

      <View style={styles.scheduleActions}>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => openPreview(item.id)}
        >
          <Feather name="eye" size={16} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary, marginLeft: Spacing.xs }}>
            Vorschau
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => handleRun(item)}
        >
          <Feather name="play" size={16} color={theme.success} />
          <ThemedText type="small" style={{ color: theme.success, marginLeft: Spacing.xs }}>
            Ausführen
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => openEditModal(item)}
        >
          <Feather name="edit-2" size={16} color={theme.primary} />
        </Pressable>
        <Pressable
          style={[styles.actionButton, { backgroundColor: isDark ? theme.errorLight : `${theme.error}15` }]}
          onPress={() => handleDelete(item)}
        >
          <Feather name="trash-2" size={16} color={theme.error} />
        </Pressable>
      </View>
    </Card>
  );

  const renderEmptyState = () => (
    <EmptyState
      icon="clock"
      title="Keine Zeitpläne"
      message="Erstellen Sie einen Zeitplan für automatische Aufgabenerstellung."
    />
  );

  if (isLoading) {
    return <LoadingScreen fullScreen={false} message="Zeitpläne werden geladen..." />;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={schedules}
        keyExtractor={(item) => item.id}
        renderItem={renderScheduleItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl + 80 },
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.fabContainer, { bottom: tabBarHeight + Spacing.lg }]}>
        <Pressable
          style={[styles.fabSecondary, { backgroundColor: theme.primary }]}
          onPress={openTaskModal}
        >
          <Feather name="file-plus" size={20} color={theme.textOnAccent} />
        </Pressable>
        <Pressable
          style={[styles.fab, { backgroundColor: theme.accent }]}
          onPress={openCreateModal}
        >
          <Feather name="plus" size={24} color={theme.textOnAccent} />
        </Pressable>
      </View>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <ThemedView style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowModal(false)}>
              <ThemedText type="body" style={{ color: theme.primary }}>Abbrechen</ThemedText>
            </Pressable>
            <ThemedText type="h4" style={{ color: theme.text }}>
              {editingSchedule ? "Zeitplan bearbeiten" : "Neuer Zeitplan"}
            </ThemedText>
            <Pressable onPress={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              <ThemedText type="bodyBold" style={{ color: theme.accent }}>
                {createMutation.isPending || updateMutation.isPending ? "..." : "Speichern"}
              </ThemedText>
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat style={styles.modalContent}>
            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Name
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="z.B. Morgenschicht Station A"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Stand
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.standPicker}>
                {stands.map(stand => (
                  <Pressable
                    key={stand.id}
                    style={[
                      styles.standOption,
                      {
                        backgroundColor: formData.standId === stand.id ? theme.accent : theme.backgroundSecondary,
                        borderColor: formData.standId === stand.id ? theme.accent : theme.border,
                      },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, standId: stand.id }))}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: formData.standId === stand.id ? theme.textOnAccent : theme.text }}
                    >
                      {stand.identifier}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Regeltyp
              </ThemedText>
              <View style={styles.ruleTypePicker}>
                {(["DAILY", "WEEKLY", "INTERVAL"] as const).map(type => (
                  <Pressable
                    key={type}
                    style={[
                      styles.ruleTypeOption,
                      {
                        backgroundColor: formData.ruleType === type ? theme.accent : theme.backgroundSecondary,
                        borderColor: formData.ruleType === type ? theme.accent : theme.border,
                      },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, ruleType: type }))}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: formData.ruleType === type ? theme.textOnAccent : theme.text }}
                    >
                      {getRuleTypeLabel(type)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {formData.ruleType === "WEEKLY" ? (
              <View style={styles.formGroup}>
                <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                  Wochentage
                </ThemedText>
                <View style={styles.weekdayPicker}>
                  {WEEKDAY_NAMES.map((name, index) => (
                    <Pressable
                      key={index}
                      style={[
                        styles.weekdayOption,
                        {
                          backgroundColor: formData.weekdays.includes(index + 1) ? theme.accent : theme.backgroundSecondary,
                          borderColor: formData.weekdays.includes(index + 1) ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => toggleWeekday(index + 1)}
                    >
                      <ThemedText
                        type="small"
                        style={{ color: formData.weekdays.includes(index + 1) ? theme.textOnAccent : theme.text }}
                      >
                        {name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {formData.ruleType === "INTERVAL" ? (
              <>
                <View style={styles.formGroup}>
                  <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                    Alle X Tage
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                    value={String(formData.everyNDays)}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, everyNDays: parseInt(text) || 1 }))}
                    keyboardType="number-pad"
                    placeholder="7"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={styles.formGroup}>
                  <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                    Startdatum (YYYY-MM-DD)
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                    value={formData.startDate}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, startDate: text }))}
                    placeholder="z.B. 2024-12-15"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </>
            ) : null}

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Uhrzeit (HH:MM)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={formData.timeLocal}
                onChangeText={(text) => setFormData(prev => ({ ...prev, timeLocal: text }))}
                placeholder="06:00"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Tage im Voraus erstellen
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={String(formData.createDaysAhead)}
                onChangeText={(text) => setFormData(prev => ({ ...prev, createDaysAhead: parseInt(text) || 7 }))}
                keyboardType="number-pad"
                placeholder="7"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={{ height: Spacing["2xl"] }} />
          </KeyboardAwareScrollViewCompat>
        </ThemedView>
      </Modal>

      <Modal
        visible={showPreviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowPreviewModal(false);
          setPreviewScheduleId(null);
        }}
      >
        <ThemedView style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => {
              setShowPreviewModal(false);
              setPreviewScheduleId(null);
            }}>
              <ThemedText type="body" style={{ color: theme.primary }}>Schließen</ThemedText>
            </Pressable>
            <ThemedText type="h4" style={{ color: theme.text }}>Vorschau (14 Tage)</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.previewContent}>
            {isLoadingPreview ? (
              <LoadingScreen fullScreen={false} message="Vorschau wird geladen..." />
            ) : previewDates && previewDates.length > 0 ? (
              previewDates.map((date, index) => (
                <Card key={index} style={{ backgroundColor: theme.cardSurface, marginBottom: Spacing.sm }}>
                  <View style={styles.previewRow}>
                    <Feather name="calendar" size={16} color={theme.primary} />
                    <View style={{ marginLeft: Spacing.md }}>
                      <ThemedText type="bodyBold" style={{ color: theme.text }}>
                        {date.formattedDate}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {date.dayOfWeek}
                      </ThemedText>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <EmptyState
                icon="calendar"
                title="Keine Termine"
                message="Für die nächsten 14 Tage sind keine Aufgaben geplant."
              />
            )}
          </ScrollView>
        </ThemedView>
      </Modal>

      <Modal
        visible={showTaskModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTaskModal(false)}
      >
        <ThemedView style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Pressable onPress={() => setShowTaskModal(false)}>
              <ThemedText type="body" style={{ color: theme.primary }}>Abbrechen</ThemedText>
            </Pressable>
            <ThemedText type="h4" style={{ color: theme.text }}>
              Neue Aufgabe
            </ThemedText>
            <Pressable onPress={handleTaskSubmit} disabled={createTaskMutation.isPending}>
              <ThemedText type="bodyBold" style={{ color: theme.accent }}>
                {createTaskMutation.isPending ? "..." : "Erstellen"}
              </ThemedText>
            </Pressable>
          </View>

          <KeyboardAwareScrollViewCompat style={styles.modalContent}>
            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Titel
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={taskFormData.title}
                onChangeText={(text) => setTaskFormData(prev => ({ ...prev, title: text }))}
                placeholder="z.B. Abholung Stand A1"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Stand
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.standPicker}>
                {stands.map(stand => (
                  <Pressable
                    key={stand.id}
                    style={[
                      styles.standOption,
                      {
                        backgroundColor: taskFormData.standId === stand.id ? theme.accent : theme.backgroundSecondary,
                        borderColor: taskFormData.standId === stand.id ? theme.accent : theme.border,
                      },
                    ]}
                    onPress={() => setTaskFormData(prev => ({ ...prev, standId: stand.id }))}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: taskFormData.standId === stand.id ? theme.textOnAccent : theme.text }}
                    >
                      {stand.identifier}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Beschreibung (optional)
              </ThemedText>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={taskFormData.description}
                onChangeText={(text) => setTaskFormData(prev => ({ ...prev, description: text }))}
                placeholder="Zusätzliche Hinweise..."
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Priorität
              </ThemedText>
              <View style={styles.ruleTypePicker}>
                {(["LOW", "NORMAL", "HIGH", "URGENT"] as const).map(priority => (
                  <Pressable
                    key={priority}
                    style={[
                      styles.ruleTypeOption,
                      {
                        backgroundColor: taskFormData.priority === priority ? theme.accent : theme.backgroundSecondary,
                        borderColor: taskFormData.priority === priority ? theme.accent : theme.border,
                      },
                    ]}
                    onPress={() => setTaskFormData(prev => ({ ...prev, priority }))}
                  >
                    <ThemedText
                      type="small"
                      style={{ color: taskFormData.priority === priority ? theme.textOnAccent : theme.text }}
                    >
                      {getPriorityLabel(priority)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
                Geplant für (optional, YYYY-MM-DD)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                value={taskFormData.scheduledFor}
                onChangeText={(text) => setTaskFormData(prev => ({ ...prev, scheduledFor: text }))}
                placeholder="z.B. 2024-12-15"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={{ height: Spacing["2xl"] }} />
          </KeyboardAwareScrollViewCompat>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  scheduleHeader: {
    marginBottom: Spacing.sm,
  },
  scheduleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleDetails: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scheduleActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  fabContainer: {
    position: "absolute",
    right: Spacing.lg,
    gap: Spacing.md,
    alignItems: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabSecondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    minHeight: IndustrialDesign.minTouchTarget,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  standPicker: {
    flexDirection: "row",
  },
  standOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  ruleTypePicker: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  ruleTypeOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  weekdayPicker: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  weekdayOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewContent: {
    paddingBottom: Spacing.xl,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
});
