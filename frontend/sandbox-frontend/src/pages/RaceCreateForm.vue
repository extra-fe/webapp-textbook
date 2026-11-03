<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  CreateRaceFormSchema,
  type CreateRaceFormValues,
} from "../../../../shared/src/race-validation";
import ConfirmDialog from "../components/ConfirmDialog.vue";
import { useConfirmDialog } from "../composables/useConfirmDialog";
import { useSubmit } from "../composables/useSubmit";

// API 呼び出しは親（RaceListPage）が持ち、このコンポーネントは検証と
// 送信の制御だけを受け持つ。
const props = defineProps<{
  onSubmit: (values: CreateRaceFormValues) => Promise<void>;
}>();

const { handleSubmit, errors, defineField, resetForm } =
  useForm<CreateRaceFormValues>({
    validationSchema: toTypedSchema(CreateRaceFormSchema),
    initialValues: { date: "", name: "", venue: "" },
  });

const [date, dateAttrs] = defineField("date");
const [name, nameAttrs] = defineField("name");
const [venue, venueAttrs] = defineField("venue");

const { t } = useI18n();
const { isOpen, open, close } = useConfirmDialog();
const pendingValues = ref<CreateRaceFormValues | null>(null);

// フォームの送信では「開く」だけ。検証はここで済んでいる
const onFormSubmit = handleSubmit((values) => {
  pendingValues.value = values;
  open();
});

// 実際に送るのは「確定」なので、二重送信ガードもこちらに移す
const { isSubmitting, submit } = useSubmit(
  async (values: CreateRaceFormValues) => {
    try {
      await props.onSubmit(values);
      resetForm();
    } finally {
      close();
      pendingValues.value = null;
    }
  },
);

const handleConfirm = () => {
  if (!pendingValues.value) return;
  void submit(pendingValues.value);
};
</script>

<template>
  <form novalidate class="mt-6 space-y-3" @submit="onFormSubmit">
    <!-- label の for と input の id を対にする -->
    <div>
      <label for="date" class="block text-sm text-slate-700">開催日</label>
      <input
        id="date"
        v-model="date"
        v-bind="dateAttrs"
        type="date"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        :aria-invalid="!!errors.date"
        :aria-describedby="errors.date ? 'date-error' : undefined"
      />
      <p v-if="errors.date" id="date-error" class="mt-1 text-xs text-red-600">
        {{ errors.date }}
      </p>
    </div>

    <div>
      <label for="name" class="block text-sm text-slate-700">レース名</label>
      <input
        id="name"
        v-model="name"
        v-bind="nameAttrs"
        type="text"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        :aria-invalid="!!errors.name"
        :aria-describedby="errors.name ? 'name-error' : undefined"
      />
      <p v-if="errors.name" id="name-error" class="mt-1 text-xs text-red-600">
        {{ errors.name }}
      </p>
    </div>

    <div>
      <label for="venue" class="block text-sm text-slate-700">競馬場</label>
      <input
        id="venue"
        v-model="venue"
        v-bind="venueAttrs"
        type="text"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
        :aria-invalid="!!errors.venue"
        :aria-describedby="errors.venue ? 'venue-error' : undefined"
      />
      <p v-if="errors.venue" id="venue-error" class="mt-1 text-xs text-red-600">
        {{ errors.venue }}
      </p>
    </div>

    <button
      type="submit"
      :disabled="isSubmitting"
      class="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
    >
      {{ isSubmitting ? "送信中…" : "レースを登録" }}
    </button>
  </form>

  <ConfirmDialog
    :is-open="isOpen"
    :title="t('race.create.confirmDialog.title')"
    :message="t('race.create.confirmDialog.message')"
    :is-loading="isSubmitting"
    @confirm="handleConfirm"
    @cancel="close"
  />
</template>
